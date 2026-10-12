// Rockoon Digital Twin Simulation Kernel
// Multi-body flight mechanics, RK4/Euler numerical integration, wind profile,
// sensor fault injection engine, and telemetry data pipeline.

import { CONSTANTS, calculateAtmosphere, pressureToAltitude } from './isaAtmosphere.js';
import { BalloonSystem } from './balloonDynamics.js';
import { SbrlPyramidalRocket, ROCKET_STATUS } from './rocketDynamics.js';

export const FLIGHT_PHASES = {
  PRELAUNCH: 'PRELAUNCH',
  TROPOSPHERIC_ASCENT: 'TROPOSPHERIC_ASCENT',
  JET_STREAM_TRANSIT: 'JET_STREAM_TRANSIT',
  STRATOSPHERIC_ASCENT: 'STRATOSPHERIC_ASCENT',
  SBRL_RELEASE_WINDOW: 'SBRL_RELEASE_WINDOW',
  STRATOPAUSE_FLOAT: 'STRATOPAUSE_FLOAT',
  RAIL_RELEASE: 'RAIL_RELEASE',
  SEPARATED: 'SEPARATED',
  STAGE1_BURN: 'STAGE1_BURN',
  STAGE2_BURN: 'STAGE2_BURN',
  COAST: 'COAST'
};

export class SimulationKernel {
  constructor() {
    this.balloon = new BalloonSystem();
    this.rocket = new SbrlPyramidalRocket();

    // Environment Configuration
    this.env = {
      windSpeedKmh: 45.0,        // 0 to 120 km/h
      windDirectionDeg: 180.0,   // 0 to 360 deg (180 = from South toward North)
      turbulenceLevel: 'mild',   // 'calm' | 'mild' | 'severe'
      tempDeltaC: 0.0,           // -30 to +30 °C
      surfaceHumidityPct: 65.0,  // 0 to 100%
      pressureScale: 1.0,        // 0.8x to 1.2x
    };

    // Fault Injection Flags
    this.faults = {
      baroStick: false,
      baroDriftActive: false,
      imuNoise: false,
      pitotIcing: false,
      gpsLoss: false,
      telemetryDrop: false,
    };

    // State Vectors (Vehicle / Rocket on Ground Pad)
    this.timeMs = 0;
    this.position = { x: 0.0, y: 0.0, z: 0.0 }; // Ground launch pad (0 m)
    this.velocity = { vx: 0.0, vy: 0.0, vz: 0.0 };
    this.acceleration = { ax: 0.0, ay: 0.0, az: 0.0 };

    // Latitude / Longitude origin (Launch base)
    this.originLat = 37.100;
    this.originLon = -6.733;

    // Balloon flight train state
    this.isTetherAttached = true;
    this.safetyAltitudeM = 36000.0; // 36 km minimum safety altitude for SBRL release
    this.safetyOverride = false;

    // Sensor state filters & fault state variables
    this.stuckBaroPressure = null;
    this.baroDriftHpa = 0.0;
    this.gpsDropoutCountdown = 0;
    this.cachedGpsPos = null;

    // Telemetry Logging Buffer
    this.sampleRateHz = 10;
    this.telemetryBuffer = [];
    this.maxBufferSize = 15000;
    this.lastLogTimeMs = 0;

    // Explicit Mission Lifecycle Control (Starts on Ground Pad until user clicks Start)
    this.hasLaunched = false;
    this.isRunning = false;
    this.timeWarp = 1.0; // 1x, 2x, 5x, 10x, 25x, 50x
  }

  startMission() {
    this.hasLaunched = true;
    this.isRunning = true;
    return true;
  }

  pauseMission() {
    this.isRunning = false;
    return false;
  }

  resumeMission() {
    if (this.hasLaunched) {
      this.isRunning = true;
    } else {
      this.startMission();
    }
    return this.isRunning;
  }

  toggleRunning() {
    if (!this.hasLaunched) {
      return this.startMission();
    }
    this.isRunning = !this.isRunning;
    return this.isRunning;
  }

  setTimeWarp(warp) {
    this.timeWarp = warp;
  }

  setSafetyOverride(override) {
    this.safetyOverride = override;
  }

  setEnvParam(key, val) {
    this.env[key] = val;
  }

  toggleFault(key) {
    this.faults[key] = !this.faults[key];
  }

  resetEnvAndFaults() {
    this.env.windSpeedKmh = 45.0;
    this.env.windDirectionDeg = 180.0;
    this.env.turbulenceLevel = 'mild';
    this.env.tempDeltaC = 0.0;
    this.env.surfaceHumidityPct = 65.0;
    this.env.pressureScale = 1.0;

    this.faults.baroStick = false;
    this.faults.baroDriftActive = false;
    this.faults.imuNoise = false;
    this.faults.pitotIcing = false;
    this.faults.gpsLoss = false;
    this.faults.telemetryDrop = false;
  }

  reset() {
    this.balloon = new BalloonSystem();
    this.rocket = new SbrlPyramidalRocket();
    this.timeMs = 0;
    this.position = { x: 0.0, y: 0.0, z: 0.0 };
    this.velocity = { vx: 0.0, vy: 0.0, vz: 0.0 };
    this.acceleration = { ax: 0.0, ay: 0.0, az: 0.0 };
    this.isTetherAttached = true;
    this.stuckBaroPressure = null;
    this.baroDriftHpa = 0.0;
    this.gpsDropoutCountdown = 0;
    this.cachedGpsPos = null;
    this.telemetryBuffer = [];
    this.lastLogTimeMs = 0;
    this.hasLaunched = false;
    this.isRunning = false;
  }

  /**
   * Determine wind vector based on altitude profile and turbulence
   */
  getWindVector(altitudeM) {
    const baseSpeedMps = (this.env.windSpeedKmh / 3.6);
    const rad = (this.env.windDirectionDeg * Math.PI) / 180;
    
    // Altitude profile multiplier:
    // Low winds on ground, strong Jet Stream peak at 9.5-12 km, calm stratosphere at 22-38 km
    let profileMultiplier = 1.0;
    if (altitudeM < 2000) {
      profileMultiplier = 0.4 + 0.6 * (altitudeM / 2000);
    } else if (altitudeM >= 8000 && altitudeM <= 13500) {
      // Jet Stream amplification
      const jetPeak = 10500;
      const sigma = 2000;
      const gaussian = Math.exp(-Math.pow(altitudeM - jetPeak, 2) / (2 * sigma * sigma));
      profileMultiplier = 1.0 + 1.2 * gaussian;
    } else if (altitudeM > 18000) {
      // Stratospheric lull & stable float corridor up to 40 km
      profileMultiplier = Math.max(0.15, 0.85 - 0.7 * Math.min(1.0, (altitudeM - 18000) / 18000));
    }

    // Turbulence intensity
    let turbIntensity = 0.0;
    if (this.env.turbulenceLevel === 'mild') turbIntensity = 0.15;
    if (this.env.turbulenceLevel === 'severe') turbIntensity = 0.45;

    // Harmonic wind gust fluctuations
    const tSec = this.timeMs / 1000;
    const gustX = Math.sin(tSec * 0.8 + altitudeM * 0.001) * 0.5 + Math.cos(tSec * 2.3) * 0.3;
    const gustZ = Math.cos(tSec * 0.7 + altitudeM * 0.0012) * 0.5 + Math.sin(tSec * 1.9) * 0.3;
    const gustY = Math.sin(tSec * 1.5) * 0.2; // Up/downdraft

    const totalSpeedMps = baseSpeedMps * profileMultiplier * (1 + turbIntensity * gustX);

    return {
      vx: totalSpeedMps * Math.sin(rad) + (turbIntensity * baseSpeedMps * gustX),
      vy: turbIntensity * baseSpeedMps * 0.4 * gustY,
      vz: totalSpeedMps * Math.cos(rad) + (turbIntensity * baseSpeedMps * gustZ),
    };
  }

  /**
   * Determine flight phase string for Aeroin SpaceTech SBRL
   */
  getFlightPhase() {
    if (!this.hasLaunched) {
      return FLIGHT_PHASES.PRELAUNCH;
    }
    if (this.position.y < 25 && this.velocity.vy < 0.1 && this.rocket.status === ROCKET_STATUS.SLUNG) {
      return FLIGHT_PHASES.PRELAUNCH;
    }
    if (this.rocket.status === ROCKET_STATUS.STAGE1_BURN) return FLIGHT_PHASES.STAGE1_BURN;
    if (this.rocket.status === ROCKET_STATUS.STAGE2_BURN) return FLIGHT_PHASES.STAGE2_BURN;
    if (this.rocket.status === ROCKET_STATUS.COAST) return FLIGHT_PHASES.COAST;
    if (this.rocket.status === ROCKET_STATUS.RAIL_RELEASE || this.rocket.status === ROCKET_STATUS.SEPARATED) {
      return FLIGHT_PHASES.RAIL_RELEASE;
    }

    // Balloon ascent phases leading to 36-40 km
    if (this.position.y >= 8500 && this.position.y <= 13500) {
      return FLIGHT_PHASES.JET_STREAM_TRANSIT;
    }
    if (this.position.y > 13500 && this.position.y < 36000) {
      return FLIGHT_PHASES.STRATOSPHERIC_ASCENT;
    }
    if (this.position.y >= 36000 && this.position.y <= 40000) {
      return FLIGHT_PHASES.SBRL_RELEASE_WINDOW;
    }
    if (this.position.y > 40000) {
      return FLIGHT_PHASES.STRATOPAUSE_FLOAT;
    }
    return FLIGHT_PHASES.TROPOSPHERIC_ASCENT;
  }

  /**
   * Forward-rail / Cut-down pyrotechnic trigger from tetrahedral cradle
   */
  triggerCutDown() {
    if (!this.isTetherAttached) return false;
    this.isTetherAttached = false;
    this.balloon.isCutDown = true;
    this.rocket.status = ROCKET_STATUS.RAIL_RELEASE;
    return true;
  }

  /**
   * Arm rocket trigger
   */
  armRocket() {
    if (this.rocket.status === ROCKET_STATUS.SLUNG) {
      this.rocket.status = ROCKET_STATUS.ARMED;
      return true;
    }
    return false;
  }

  /**
   * Manual Rocket Ignition Trigger (36,000 m safety threshold)
   */
  triggerIgnition() {
    const isAboveSafety = this.position.y >= this.safetyAltitudeM || this.safetyOverride;
    if (!isAboveSafety) {
      return { success: false, reason: `Safety Interlock Active: Altitude (${Math.round(this.position.y)}m) is below 36,000m SBRL threshold.` };
    }

    if (this.isTetherAttached) {
      this.triggerCutDown();
    }

    this.rocket.status = ROCKET_STATUS.STAGE1_BURN;
    return { success: true, reason: 'SBRL Stage 1 Vacuum Ignition Confirmed.' };
  }

  /**
   * Run one integration timestep (dt seconds)
   */
  integrate(dt) {
    if (!this.hasLaunched || !this.isRunning || dt <= 0) return;

    const atmo = calculateAtmosphere(this.position.y, this.env);
    const wind = this.getWindVector(this.position.y);

    if (this.isTetherAttached) {
      // ================= ASCENT PHASE (BALLOON + ROCKET COUPLED) =================
      const balloonState = this.balloon.getState(this.position.y, this.velocity, this.env);
      const totalSystemMass = balloonState.systemDeadMassKg + this.rocket.getMassKg();

      // Buoyant lift pulling upwards
      const fBuoyantY = balloonState.buoyantForceN;

      // Gravity pulling downwards
      const fGravityY = totalSystemMass * CONSTANTS.g0;

      // Vertical drag
      const relVy = this.velocity.vy - wind.vy;
      const fDragY = 0.5 * atmo.rho_air * relVy * Math.abs(relVy) * this.balloon.dragCoeff * balloonState.crossSectionAreaM2;

      // Horizontal wind drag coupling (pushes vehicle along wind)
      const relVx = this.velocity.vx - wind.vx;
      const relVz = this.velocity.vz - wind.vz;
      const horizCouplingK = 0.8; // Aerodynamic drag coupling constant
      const fWindDragX = -0.5 * atmo.rho_air * relVx * Math.abs(relVx) * this.balloon.dragCoeff * balloonState.crossSectionAreaM2 * horizCouplingK;
      const fWindDragZ = -0.5 * atmo.rho_air * relVz * Math.abs(relVz) * this.balloon.dragCoeff * balloonState.crossSectionAreaM2 * horizCouplingK;

      // Net accelerations
      this.acceleration.ay = (fBuoyantY - fGravityY - fDragY) / totalSystemMass;
      this.acceleration.ax = fWindDragX / totalSystemMass;
      this.acceleration.az = fWindDragZ / totalSystemMass;

      // Gentle balloon pendulum sway attitude
      const tSec = this.timeMs / 1000;
      this.rocket.attitudeRpyDeg.pitch = 90.0 + Math.sin(tSec * 0.9) * (this.env.turbulenceLevel === 'severe' ? 6.0 : 1.5);
      this.rocket.attitudeRpyDeg.roll = Math.cos(tSec * 1.1) * (this.env.turbulenceLevel === 'severe' ? 5.0 : 1.2);
      this.rocket.attitudeRpyDeg.yaw = (this.env.windDirectionDeg + 180 + Math.sin(tSec * 0.3) * 5) % 360;

    } else {
      // ================= FREE ROCKET FLIGHT PHASE =================
      const rocketMass = this.rocket.getMassKg();
      const { thrustN } = this.rocket.computeThrust(atmo.P_pa);
      const aero = this.rocket.computeAero(this.position.y, this.velocity, atmo);

      // Pitch and Yaw direction cosines
      const pitchRad = (this.rocket.attitudeRpyDeg.pitch * Math.PI) / 180;
      const yawRad = (this.rocket.attitudeRpyDeg.yaw * Math.PI) / 180;

      const thrustDirX = Math.cos(pitchRad) * Math.sin(yawRad);
      const thrustDirY = Math.sin(pitchRad);
      const thrustDirZ = Math.cos(pitchRad) * Math.cos(yawRad);

      const fThrustX = thrustN * thrustDirX;
      const fThrustY = thrustN * thrustDirY;
      const fThrustZ = thrustN * thrustDirZ;

      const fGravityY = rocketMass * CONSTANTS.g0;

      this.acceleration.ax = (fThrustX + aero.dragVector.fx) / rocketMass;
      this.acceleration.ay = (fThrustY - fGravityY + aero.dragVector.fy) / rocketMass;
      this.acceleration.az = (fThrustZ + aero.dragVector.fz) / rocketMass;

      // Step rocket fuel consumption & attitude guidance
      this.rocket.step(dt, atmo.P_pa);
    }

    // Semi-implicit Euler integration
    this.velocity.vx += this.acceleration.ax * dt;
    this.velocity.vy += this.acceleration.ay * dt;
    this.velocity.vz += this.acceleration.az * dt;

    this.position.x += this.velocity.vx * dt;
    this.position.y = Math.max(0, this.position.y + this.velocity.vy * dt);
    this.position.z += this.velocity.vz * dt;

    this.timeMs += dt * 1000;

    // Record telemetry sample according to sampleRateHz
    const sampleIntervalMs = 1000 / this.sampleRateHz;
    if (this.timeMs - this.lastLogTimeMs >= sampleIntervalMs) {
      this.recordTelemetryRecord();
      this.lastLogTimeMs = this.timeMs;
    }
  }

  /**
   * Generate simulated sensor readings and apply Fault Injection logic
   */
  generateSensorReadings() {
    const atmo = calculateAtmosphere(this.position.y, this.env);
    const wind = this.getWindVector(this.position.y);
    const trueAlt = this.position.y;
    const truePres = atmo.P_hpa;

    // 1. BAROMETER FAULT INJECTION
    let measuredPressureHpa = truePres;
    let baroStatus = 'NOMINAL';

    if (this.faults.baroStick) {
      if (this.stuckBaroPressure === null) this.stuckBaroPressure = truePres;
      measuredPressureHpa = this.stuckBaroPressure;
      baroStatus = 'FAILED';
    } else {
      this.stuckBaroPressure = null;
    }

    if (this.faults.baroDriftActive) {
      this.baroDriftHpa += 0.05 * (Math.random() - 0.4); // Random walk drift
      measuredPressureHpa += this.baroDriftHpa;
      baroStatus = 'DEGRADED';
    }

    // Small normal sensor Gaussian noise
    measuredPressureHpa += (Math.random() - 0.5) * 0.08;
    const derivedBaroAlt = pressureToAltitude(measuredPressureHpa, this.env.tempDeltaC);

    // 2. IMU FAULT INJECTION
    let imuStatus = 'NOMINAL';
    let accelNoiseX = (Math.random() - 0.5) * 0.04;
    let accelNoiseY = (Math.random() - 0.5) * 0.04;
    let accelNoiseZ = (Math.random() - 0.5) * 0.04;
    let gyroNoiseP = (Math.random() - 0.5) * 0.05;
    let gyroNoiseR = (Math.random() - 0.5) * 0.05;
    let gyroNoiseY = (Math.random() - 0.5) * 0.05;

    if (this.faults.imuNoise) {
      imuStatus = 'FAILED';
      accelNoiseX += (Math.random() - 0.5) * 2.5 + 0.8;
      accelNoiseY += (Math.random() - 0.5) * 2.5 - 1.1;
      accelNoiseZ += (Math.random() - 0.5) * 2.5;
      gyroNoiseP += (Math.random() - 0.5) * 12.0 + 3.0; // Gyro bias spike
      gyroNoiseR += (Math.random() - 0.5) * 12.0;
      gyroNoiseY += (Math.random() - 0.5) * 12.0;
    }

    const imuAccel = [
      Number((this.acceleration.ax + accelNoiseX).toFixed(3)),
      Number((this.acceleration.az + accelNoiseZ).toFixed(3)),
      Number((this.acceleration.ay + CONSTANTS.g0 + accelNoiseY).toFixed(3))
    ];

    const imuGyro = [
      Number((this.rocket.angularRateDps.pitchRate + gyroNoiseP).toFixed(3)),
      Number((this.rocket.angularRateDps.rollRate + gyroNoiseR).toFixed(3)),
      Number((this.rocket.angularRateDps.yawRate + gyroNoiseY).toFixed(3))
    ];

    const attitudeRpy = [
      Number((this.rocket.attitudeRpyDeg.roll + (this.faults.imuNoise ? (Math.random() - 0.5) * 8 : 0)).toFixed(2)),
      Number((this.rocket.attitudeRpyDeg.pitch + (this.faults.imuNoise ? (Math.random() - 0.5) * 8 : 0)).toFixed(2)),
      Number((this.rocket.attitudeRpyDeg.yaw + (this.faults.imuNoise ? (Math.random() - 0.5) * 8 : 0)).toFixed(2))
    ];

    // 3. PITOT / AIRSPEED FAULT INJECTION
    const trueAirspeed = Math.sqrt(
      Math.pow(this.velocity.vx - wind.vx, 2) +
      Math.pow(this.velocity.vy - wind.vy, 2) +
      Math.pow(this.velocity.vz - wind.vz, 2)
    );
    let measuredAirspeed = trueAirspeed;
    let pitotStatus = 'NOMINAL';
    if (this.faults.pitotIcing) {
      pitotStatus = 'FAILED';
      measuredAirspeed = Math.max(0, (Math.random() - 0.5) * 2.0); // Clogged near zero
    }

    // 4. GPS FAULT INJECTION
    let gpsStatus = 'NOMINAL';
    let gpsAlt = trueAlt;
    let gpsLat = this.originLat + (this.position.z / 111320);
    let gpsLon = this.originLon + (this.position.x / (111320 * Math.cos((this.originLat * Math.PI) / 180)));

    if (this.faults.gpsLoss) {
      gpsStatus = 'FAILED';
      // High jitter and dropout
      if (Math.random() < 0.4) {
        gpsAlt = null;
        gpsLat = null;
        gpsLon = null;
      } else {
        gpsAlt += (Math.random() - 0.5) * 250;
      }
    } else {
      gpsAlt += (Math.random() - 0.5) * 1.5; // Normal GPS precision ~1.5m
    }

    // 5. TELEMETRY PACKET LOSS
    let transceiverStatus = 'NOMINAL';
    let isPacketDropped = false;
    if (this.faults.telemetryDrop) {
      transceiverStatus = 'DEGRADED';
      if (Math.random() < 0.45) {
        isPacketDropped = true;
      }
    }

    // Balloon & Rocket state parameters
    const balloonState = this.balloon.getState(this.position.y, this.velocity, this.env);
    const { thrustN } = this.rocket.computeThrust(atmo.P_pa);

    return {
      timestamp_ms: Math.round(this.timeMs),
      flight_phase: this.getFlightPhase(),
      isPacketDropped,
      barometric_sensor: {
        pressure_hpa: Number(measuredPressureHpa.toFixed(2)),
        derived_altitude_m: Number(derivedBaroAlt.toFixed(1)),
        true_altitude_m: Number(trueAlt.toFixed(1)),
        status: baroStatus
      },
      imu_sensor: {
        accel_mps2: imuAccel,
        gyro_dps: imuGyro,
        attitude_rpy_deg: attitudeRpy,
        status: imuStatus
      },
      environmental_sensors: {
        ambient_temp_c: Number(atmo.T_c.toFixed(1)),
        relative_humidity_pct: Number(atmo.humidityPct.toFixed(1)),
        effective_wind_vector_mps: [
          Number(wind.vx.toFixed(2)),
          Number(wind.vy.toFixed(2)),
          Number(wind.vz.toFixed(2))
        ]
      },
      payload_state: {
        is_attached: this.isTetherAttached,
        balloon_volume_m3: Number(balloonState.currentVolumeM3.toFixed(1)),
        thrust_n: Number(thrustN.toFixed(1)),
        rocket_status: this.rocket.status,
        propellant_kg: Number((this.rocket.currentStage1Propellant + this.rocket.currentStage2Propellant).toFixed(1)),
        total_mass_kg: Number((this.isTetherAttached ? balloonState.systemDeadMassKg + this.rocket.getMassKg() : this.rocket.getMassKg()).toFixed(1))
      },
      navigation_state: {
        gps_altitude_m: gpsAlt !== null ? Number(gpsAlt.toFixed(1)) : null,
        lat: gpsLat !== null ? Number(gpsLat.toFixed(5)) : null,
        lon: gpsLon !== null ? Number(gpsLon.toFixed(5)) : null,
        status: gpsStatus,
        measured_airspeed_mps: Number(measuredAirspeed.toFixed(2)),
        true_airspeed_mps: Number(trueAirspeed.toFixed(2)),
        pitot_status: pitotStatus,
        transceiver_status: transceiverStatus
      }
    };
  }

  /**
   * Record telemetry record to buffer
   */
  recordTelemetryRecord() {
    const reading = this.generateSensorReadings();
    
    // If telemetry link drops this packet, we don't save to downlink log buffer
    if (!reading.isPacketDropped) {
      this.telemetryBuffer.push(reading);
      if (this.telemetryBuffer.length > this.maxBufferSize) {
        this.telemetryBuffer.shift();
      }
    }
  }

  /**
   * Export telemetry to conformant JSON schema matching Mission Brief section 4
   */
  getExportJson() {
    const records = this.telemetryBuffer.map(rec => ({
      timestamp_ms: rec.timestamp_ms,
      flight_phase: rec.flight_phase,
      barometric_sensor: {
        pressure_hpa: rec.barometric_sensor.pressure_hpa,
        derived_altitude_m: rec.barometric_sensor.derived_altitude_m,
        status: rec.barometric_sensor.status
      },
      imu_sensor: {
        accel_mps2: rec.imu_sensor.accel_mps2,
        gyro_dps: rec.imu_sensor.gyro_dps,
        attitude_rpy_deg: rec.imu_sensor.attitude_rpy_deg,
        status: rec.imu_sensor.status
      },
      environmental_sensors: {
        ambient_temp_c: rec.environmental_sensors.ambient_temp_c,
        relative_humidity_pct: rec.environmental_sensors.relative_humidity_pct,
        effective_wind_vector_mps: rec.environmental_sensors.effective_wind_vector_mps
      },
      payload_state: {
        is_attached: rec.payload_state.is_attached,
        balloon_volume_m3: rec.payload_state.balloon_volume_m3,
        thrust_n: rec.payload_state.thrust_n
      }
    }));

    return {
      mission_metadata: {
        platform_name: "Aeroin SpaceTech SBRL",
        vehicle_configuration: "Pyramidal Direct-to-Orbit Launch System",
        launch_type: "Stratospheric Balloon Rocket Launch (36-40 km)",
        firmware_build: "SBRL-AEROIN-SIM-v2.4",
        sample_rate_hz: this.sampleRateHz,
        total_samples: records.length,
        environment_presets: {
          base_wind_speed_kmh: this.env.windSpeedKmh,
          wind_direction_deg: this.env.windDirectionDeg,
          turbulence_level: this.env.turbulenceLevel,
          humidity_surface_pct: this.env.surfaceHumidityPct
        }
      },
      sensor_telemetry_records: records
    };
  }
}
