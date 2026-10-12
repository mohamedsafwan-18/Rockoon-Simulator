// Rockoon Digital Twin Simulation Kernel
// Multi-body flight mechanics, orbital mechanics (LEO insertion & suborbital failure modes),
// 34 km auto-1x speed throttle, mission scenario presets, 3D GNSS launch-pad-origin coordinates,
// sensor fault injection engine, safezone airspace boundary monitoring,
// balloon rupture/burst thresholds, and telemetry data pipeline.

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
  STAGE1_SEPARATION: 'STAGE1_SEPARATION',
  STAGE2_BURN: 'STAGE2_BURN',
  LEO_ORBIT: 'LEO_ORBIT',
  ORBIT_INSERTION_FAILURE: 'ORBIT_INSERTION_FAILURE',
  COAST: 'COAST',
  BALLOON_BURST: 'BALLOON_BURST',
  FREE_FALL: 'FREE_FALL',
  GROUND_IMPACT: 'GROUND_IMPACT',
  ILLEGAL_LAUNCH: 'ILLEGAL_LAUNCH',
};

export const MISSION_PRESETS = {
  NOMINAL_LEO: {
    id: 'NOMINAL_LEO',
    label: '✅ Nominal LEO Orbit Trajectory',
    description: 'Balloon ascends inside 35km safezone -> 34km 1x speed -> Aligned rocket propulsion & projectile gravity-turn into 212.8 km circular LEO.',
     badgeColor: 'emerald',
    env: {
      windSpeedKmh: 20.0,
      windDirectionDeg: 180.0,
      verticalWindMps: 0.0,
      windShearMpsPerKm: 2.5,
      pressureScale: 1.0,
      tempDeltaC: 0.0,
      airDensityScale: 1.0,
      turbulenceLevel: 'mild',
      lapseRateCPerKm: -6.5,
      solarRadiationWm2: 1000.0,
      surfaceHumidityPct: 65.0,
    },
    stage2FailureMode: false,
    faults: { baroStick: false, baroDriftActive: false, imuNoise: false, pitotIcing: false, gpsLoss: false, telemetryDrop: false },
  },
  OUT_OF_SAFEZONE: {
    id: 'OUT_OF_SAFEZONE',
    label: '🚫 Out of Safezone (Illegal Launch)',
    description: '85 km/h crosswinds + 12 m/s/km shear push balloon beyond 35 km maritime corridor, triggering Illegal Launch Interlock.',
    badgeColor: 'amber',
    env: {
      windSpeedKmh: 85.0,
      windDirectionDeg: 135.0,
      verticalWindMps: 1.0,
      windShearMpsPerKm: 12.0,
      pressureScale: 1.0,
      tempDeltaC: 0.0,
      airDensityScale: 1.0,
      turbulenceLevel: 'mild',
      lapseRateCPerKm: -6.5,
      solarRadiationWm2: 1000.0,
      surfaceHumidityPct: 65.0,
    },
    stage2FailureMode: false,
    faults: { baroStick: false, baroDriftActive: false, imuNoise: false, pitotIcing: false, gpsLoss: false, telemetryDrop: false },
  },
  FAILED_LEO_INSERTION: {
    id: 'FAILED_LEO_INSERTION',
    label: '⚠️ Failed LEO (Projectile Suborbital Arc)',
    description: 'Rocket propels aligned from balloon into projectile arc, but Stage 2 underburns (32% thrust) and follows ballistic projectile motion back down.',
    badgeColor: 'orange',
    env: {
      windSpeedKmh: 18.0,
      windDirectionDeg: 180.0,
      verticalWindMps: 0.5,
      windShearMpsPerKm: 2.0,
      pressureScale: 1.0,
      tempDeltaC: 0.0,
      airDensityScale: 1.0,
      turbulenceLevel: 'calm',
      lapseRateCPerKm: -6.5,
      solarRadiationWm2: 1000.0,
      surfaceHumidityPct: 55.0,
    },
    stage2FailureMode: true,
    faults: { baroStick: false, baroDriftActive: false, imuNoise: false, pitotIcing: false, gpsLoss: false, telemetryDrop: false },
  },
  BALLOON_BURST_FAILURE: {
    id: 'BALLOON_BURST_FAILURE',
    label: '💥 Envelope Burst (Projectile Drop)',
    description: 'Severe jet stream turbulence (105 km/h) + low pressure scale (0.84x) ruptures balloon; rocket follows ballistic projectile descent.',
    badgeColor: 'rose',
    env: {
      windSpeedKmh: 105.0,
      windDirectionDeg: 210.0,
      verticalWindMps: -3.5,
      windShearMpsPerKm: 22.0,
      pressureScale: 0.84,
      tempDeltaC: -15.0,
      airDensityScale: 0.95,
      turbulenceLevel: 'severe',
      lapseRateCPerKm: -9.1,
      solarRadiationWm2: 1050.0,
      surfaceHumidityPct: 80.0,
    },
    stage2FailureMode: false,
    faults: { baroStick: false, baroDriftActive: false, imuNoise: false, pitotIcing: false, gpsLoss: false, telemetryDrop: false },
  },
  SOLAR_SUPERHEAT_BURST: {
    id: 'SOLAR_SUPERHEAT_BURST',
    label: '☀️ Solar Thermal Superheat Burst',
    description: 'Extreme solar radiation (1380 W/m²) superheats helium gas above 18 km beyond membrane tensile yield.',
    badgeColor: 'rose',
    env: {
      windSpeedKmh: 22.0,
      windDirectionDeg: 180.0,
      verticalWindMps: 2.0,
      windShearMpsPerKm: 3.0,
      pressureScale: 0.92,
      tempDeltaC: 20.0,
      airDensityScale: 1.0,
      turbulenceLevel: 'mild',
      lapseRateCPerKm: -6.5,
      solarRadiationWm2: 1380.0,
      surfaceHumidityPct: 40.0,
    },
    stage2FailureMode: false,
    faults: { baroStick: false, baroDriftActive: false, imuNoise: false, pitotIcing: false, gpsLoss: false, telemetryDrop: false },
  },
  SENSOR_BLACKOUT: {
    id: 'SENSOR_BLACKOUT',
    label: '📡 Avionics Multi-Sensor Fault Storm',
    description: 'Injects Barometer Sticking, IMU Gyro Bias Spike, Pitot Icing, GPS Dropout, and RF Telemetry Loss.',
    badgeColor: 'purple',
    env: {
      windSpeedKmh: 35.0,
      windDirectionDeg: 195.0,
      verticalWindMps: 0.0,
      windShearMpsPerKm: 6.5,
      pressureScale: 1.0,
      tempDeltaC: -5.0,
      airDensityScale: 1.0,
      turbulenceLevel: 'mild',
      lapseRateCPerKm: -6.5,
      solarRadiationWm2: 1000.0,
      surfaceHumidityPct: 75.0,
    },
    stage2FailureMode: false,
    faults: { baroStick: true, baroDriftActive: true, imuNoise: true, pitotIcing: true, gpsLoss: true, telemetryDrop: true },
  },
};

const R_EARTH = 6371000.0; // Mean Earth radius in meters

export class SimulationKernel {
  constructor() {
    this.balloon = new BalloonSystem();
    this.rocket = new SbrlPyramidalRocket();
    this.activePresetId = 'NOMINAL_LEO';

    // Environment Configuration (11 Unique Non-Repeating Physical Parameters)
    this.env = {
      windSpeedKmh: 20.0,        // 1. Wind speed (0 to 120 km/h)
      windDirectionDeg: 180.0,   // 2. Wind direction (0 to 360 deg)
      verticalWindMps: 0.0,      // 3. Vertical wind velocity (-15 to +15 m/s)
      windShearMpsPerKm: 2.5,    // 4. Wind shear gradient (0 to 25 m/s/km)
      pressureScale: 1.0,        // 5. Atmospheric pressure scale (0.8x to 1.2x)
      tempDeltaC: 0.0,           // 6. Ambient temperature offset (-30 to +30 °C)
      airDensityScale: 1.0,      // 7. Air density multiplier (0.7x to 1.3x)
      turbulenceLevel: 'mild',   // 8. Atmospheric turbulence ('calm' | 'mild' | 'severe')
      lapseRateCPerKm: -6.5,     // 9. Temperature lapse rate (-9.8 to -3.5 °C/km)
      solarRadiationWm2: 1000.0, // 10. Solar radiation intensity (0 to 1400 W/m^2)
      surfaceHumidityPct: 65.0,  // 11. Surface relative humidity (0 to 100%)
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

    // State Vectors (Origin [0, 0, 0] = Ground Launch Pad)
    this.timeMs = 0;
    this.position = { x: 0.0, y: 0.0, z: 0.0 }; // Ground launch pad origin (0, 0, 0 m)
    this.velocity = { vx: 0.0, vy: 0.0, vz: 0.0 };
    this.acceleration = { ax: 0.0, ay: 0.0, az: 0.0 };
    this.orbitalAngleRad = 0.0;

    // Geodetic Coordinates of Ground Launch Pad Origin
    this.originLat = 37.100;
    this.originLon = -6.733;
    this.originAlt = 0.0;

    // Balloon flight train state
    this.isTetherAttached = true;
    this.balloonReleasePos = null; // Stores 3D coordinate where balloon released the rocket
    this.isBalloonBurst = false;
    this.balloonBurstReason = null;
    this.safetyAltitudeM = 36000.0; // 36 km minimum safety altitude for SBRL release
    this.safetyOverride = false;
    this.hasAutoSlowedAt34km = false; // Auto-throttles timeWarp to 1x when reaching 34,000 m

    // Designated Airspace Safezone (Maritime/Airspace Safety Corridor)
    this.safezoneRadiusM = 35000.0; // 35 km radius from launch pad
    this.currentDriftM = 0.0;
    this.isInsideSafezone = true;
    this.isIllegalLaunch = false;

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

    // 3D Historical Flight Trajectory Trace
    this.trajectoryPoints = [];
    this.lastTrajectoryRecordTimeMs = 0;

    // Explicit Mission Lifecycle & Pause/Resume Tracking
    this.hasLaunched = false;
    this.isRunning = false;
    this.isPaused = false;
    this.isResumed = false;
    this.missionStatus = 'PRELAUNCH'; // 'PRELAUNCH' | 'RUNNING' | 'PAUSED' | 'RESUMED'
    this.pauseCount = 0;
    this.resumeCount = 0;
    this.lastControlAction = 'INITIALIZED';
    this.lastPauseTimeMs = null;
    this.lastResumeTimeMs = null;
    this.pauseResumeEvents = [];
    this.timeWarp = 1.0;
  }

  /**
   * Apply a pre-configured engineering scenario preset
   */
  applyPreset(presetId) {
    const preset = MISSION_PRESETS[presetId];
    if (!preset) return false;

    this.activePresetId = presetId;
    Object.assign(this.env, preset.env);
    Object.assign(this.faults, preset.faults);
    this.rocket.stage2FailureMode = Boolean(preset.stage2FailureMode);

    if (this.hasLaunched && this.isTetherAttached && !this.isBalloonBurst) {
      this.checkBalloonBurst();
    }
    return true;
  }

  startMission() {
    this.hasLaunched = true;
    this.isRunning = true;
    this.isPaused = false;
    this.isResumed = false;
    this.missionStatus = 'RUNNING';
    this.lastControlAction = 'STARTED';
    this.pauseResumeEvents.push({
      action: 'STARTED',
      mission_time_ms: Math.round(this.timeMs),
      iso_time: new Date().toISOString(),
    });
    return true;
  }

  pauseMission() {
    this.isRunning = false;
    this.isPaused = true;
    this.missionStatus = 'PAUSED';
    this.pauseCount += 1;
    this.lastControlAction = 'PAUSED';
    this.lastPauseTimeMs = Math.round(this.timeMs);
    this.pauseResumeEvents.push({
      action: 'PAUSED',
      mission_time_ms: Math.round(this.timeMs),
      iso_time: new Date().toISOString(),
    });
    return false;
  }

  resumeMission() {
    if (this.hasLaunched) {
      this.isRunning = true;
      this.isPaused = false;
      this.isResumed = true;
      this.missionStatus = 'RESUMED';
      this.resumeCount += 1;
      this.lastControlAction = 'RESUMED';
      this.lastResumeTimeMs = Math.round(this.timeMs);
      this.pauseResumeEvents.push({
        action: 'RESUMED',
        mission_time_ms: Math.round(this.timeMs),
        iso_time: new Date().toISOString(),
      });
    } else {
      this.startMission();
    }
    return this.isRunning;
  }

  toggleRunning() {
    if (!this.hasLaunched) {
      return this.startMission();
    }
    if (this.isRunning) {
      return this.pauseMission();
    }
    return this.resumeMission();
  }

  setTimeWarp(warp) {
    this.timeWarp = warp;
  }

  setSafetyOverride(override) {
    this.safetyOverride = override;
  }

  setEnvParam(key, val) {
    this.env[key] = val;

    if (this.hasLaunched && this.isTetherAttached && !this.isBalloonBurst) {
      this.checkBalloonBurst();
    }
  }

  toggleFault(key) {
    this.faults[key] = !this.faults[key];
  }

  resetEnvAndFaults() {
    this.applyPreset('NOMINAL_LEO');
  }

  reset() {
    const keepStage2Fail = this.rocket?.stage2FailureMode || false;
    this.balloon = new BalloonSystem();
    this.rocket = new SbrlPyramidalRocket();
    this.rocket.stage2FailureMode = keepStage2Fail;
    this.timeMs = 0;
    this.position = { x: 0.0, y: 0.0, z: 0.0 };
    this.velocity = { vx: 0.0, vy: 0.0, vz: 0.0 };
    this.acceleration = { ax: 0.0, ay: 0.0, az: 0.0 };
    this.orbitalAngleRad = 0.0;
    this.isTetherAttached = true;
    this.balloonReleasePos = null;
    this.isBalloonBurst = false;
    this.balloonBurstReason = null;
    this.hasAutoSlowedAt34km = false;
    this.currentDriftM = 0.0;
    this.isInsideSafezone = true;
    this.isIllegalLaunch = false;
    this.stuckBaroPressure = null;
    this.baroDriftHpa = 0.0;
    this.gpsDropoutCountdown = 0;
    this.cachedGpsPos = null;
    this.telemetryBuffer = [];
    this.trajectoryPoints = [];
    this.lastLogTimeMs = 0;
    this.lastTrajectoryRecordTimeMs = 0;
    this.hasLaunched = false;
    this.isRunning = false;
    this.isPaused = false;
    this.isResumed = false;
    this.missionStatus = 'PRELAUNCH';
    this.pauseCount = 0;
    this.resumeCount = 0;
    this.lastControlAction = 'RESTARTED';
    this.lastPauseTimeMs = null;
    this.lastResumeTimeMs = null;
    this.pauseResumeEvents = [];
  }

  /**
   * Determine wind vector based on altitude profile, wind shear, vertical wind, and turbulence
   */
  getWindVector(altitudeM) {
    if (altitudeM >= 50000) {
      return { vx: 0.0, vy: 0.0, vz: 0.0 };
    }

    const baseSpeedMps = this.env.windSpeedKmh / 3.6;
    const rad = (this.env.windDirectionDeg * Math.PI) / 180;
    const windShear = this.env.windShearMpsPerKm !== undefined ? this.env.windShearMpsPerKm : 2.5;
    const verticalWind = this.env.verticalWindMps !== undefined ? this.env.verticalWindMps : 0.0;

    let profileMultiplier = 1.0;
    if (altitudeM < 2000) {
      profileMultiplier = 0.4 + 0.6 * (altitudeM / 2000);
    } else if (altitudeM >= 8000 && altitudeM <= 13500) {
      const jetPeak = 10500;
      const sigma = 2000;
      const gaussian = Math.exp(-Math.pow(altitudeM - jetPeak, 2) / (2 * sigma * sigma));
      const shearBoost = (windShear - 2.5) * 0.06;
      profileMultiplier = 1.0 + (1.2 + Math.max(0, shearBoost)) * gaussian;
    } else if (altitudeM > 18000 && altitudeM < 50000) {
      profileMultiplier = Math.max(0.15, 0.85 - 0.7 * Math.min(1.0, (altitudeM - 18000) / 18000));
    }

    let turbIntensity = 0.0;
    if (this.env.turbulenceLevel === 'mild') turbIntensity = 0.15;
    if (this.env.turbulenceLevel === 'severe') turbIntensity = 0.55;

    const tSec = this.timeMs / 1000;
    const gustX = Math.sin(tSec * 0.8 + altitudeM * 0.001) * 0.5 + Math.cos(tSec * 2.3) * 0.3;
    const gustZ = Math.cos(tSec * 0.7 + altitudeM * 0.0012) * 0.5 + Math.sin(tSec * 1.9) * 0.3;
    const gustY = Math.sin(tSec * 1.5) * 0.2;

    const totalSpeedMps = baseSpeedMps * profileMultiplier * (1 + turbIntensity * gustX);
    const vertAttenuation = altitudeM > 20000 ? Math.max(0.1, 1.0 - (altitudeM - 20000) / 30000) : 1.0;

    return {
      vx: totalSpeedMps * Math.sin(rad) + turbIntensity * baseSpeedMps * gustX,
      vy: verticalWind * vertAttenuation + turbIntensity * baseSpeedMps * 0.4 * gustY,
      vz: totalSpeedMps * Math.cos(rad) + turbIntensity * baseSpeedMps * gustZ,
    };
  }

  /**
   * Check if environmental or flight conditions burst the balloon
   */
  checkBalloonBurst() {
    if (this.isBalloonBurst || !this.isTetherAttached) return false;

    const wind = this.getWindVector(this.position.y);
    const result = this.balloon.checkBurst(this.position.y, this.env, this.velocity, wind);

    if (result.isBurst) {
      this.handleBalloonBurst(result.reason);
      return true;
    }
    return false;
  }

  /**
   * Trigger Balloon Rupture / Burst
   */
  handleBalloonBurst(reason = 'BALLOON ENVELOPE RUPTURE') {
    this.isBalloonBurst = true;
    this.balloonBurstReason = reason;
    this.isTetherAttached = false;
    this.balloon.isBurst = true;
    this.balloon.isCutDown = true;
    return true;
  }

  triggerBalloonBurst(reason = 'MANUAL TEST BURST: Overpressure burst command issued from Sandbox') {
    return this.handleBalloonBurst(reason);
  }

  /**
   * Determine flight phase string for Aeroin SpaceTech SBRL
   */
  getFlightPhase() {
    if (!this.hasLaunched) {
      return FLIGHT_PHASES.PRELAUNCH;
    }

    if (this.isBalloonBurst && this.rocket.status === ROCKET_STATUS.SLUNG) {
      return this.position.y <= 1.0 ? FLIGHT_PHASES.GROUND_IMPACT : FLIGHT_PHASES.BALLOON_BURST;
    }

    if (!this.isTetherAttached && this.rocket.status === ROCKET_STATUS.RAIL_RELEASE && this.velocity.vy < -2.0) {
      return this.position.y <= 1.0 ? FLIGHT_PHASES.GROUND_IMPACT : FLIGHT_PHASES.FREE_FALL;
    }

    if (this.position.y <= 1.0 && this.hasLaunched && (this.isBalloonBurst || !this.isTetherAttached) && this.velocity.vy <= 0) {
      return FLIGHT_PHASES.GROUND_IMPACT;
    }

    if (this.rocket.status === ROCKET_STATUS.STAGE1_BURN) return FLIGHT_PHASES.STAGE1_BURN;
    if (this.rocket.status === ROCKET_STATUS.STAGE1_SEPARATION) return FLIGHT_PHASES.STAGE1_SEPARATION;
    if (this.rocket.status === ROCKET_STATUS.STAGE2_BURN) return FLIGHT_PHASES.STAGE2_BURN;
    if (this.rocket.status === ROCKET_STATUS.LEO_ORBIT) return FLIGHT_PHASES.LEO_ORBIT;
    if (this.rocket.status === ROCKET_STATUS.ORBIT_INSERTION_FAILURE) return FLIGHT_PHASES.ORBIT_INSERTION_FAILURE;
    if (this.rocket.status === ROCKET_STATUS.COAST) return FLIGHT_PHASES.COAST;
    if (this.rocket.status === ROCKET_STATUS.RAIL_RELEASE || this.rocket.status === ROCKET_STATUS.SEPARATED) {
      return FLIGHT_PHASES.RAIL_RELEASE;
    }

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
    this.balloonReleasePos = {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      orbitalAngleRad: this.orbitalAngleRad,
    };
    this.balloon.isCutDown = true;
    this.rocket.status = ROCKET_STATUS.RAIL_RELEASE;
    this.rocket.attitudeRpyDeg = { roll: 0.0, pitch: 88.0, yaw: 0.0 };
    return true;
  }

  armRocket() {
    if (this.rocket.status === ROCKET_STATUS.SLUNG) {
      this.rocket.status = ROCKET_STATUS.ARMED;
      return true;
    }
    return false;
  }

  /**
   * Manual Rocket Ignition Trigger (Propels properly aligned from initial balloon launch stage into projectile motion)
   */
  triggerIgnition() {
    const isAboveSafety = this.position.y >= this.safetyAltitudeM || this.safetyOverride;
    if (!isAboveSafety) {
      return {
        success: false,
        reason: `Safety Interlock Active: Altitude (${Math.round(this.position.y)}m) is below 36,000m SBRL threshold.`,
      };
    }

    if (!this.isInsideSafezone && !this.safetyOverride) {
      this.isIllegalLaunch = true;
      return {
        success: false,
        reason: `RANGE SAFETY HOLD: ILLEGAL ROCKET LAUNCH! Vehicle is outside approved 35 km safety corridor (${(this.currentDriftM / 1000).toFixed(1)} km drift). Safety interlock engaged.`,
      };
    }

    if (this.isTetherAttached) {
      this.triggerCutDown();
    }

    // Lock rocket alignment to the balloon's upright launch frame and propel immediately into projectile arc
    this.rocket.attitudeRpyDeg = { roll: 0.0, pitch: 88.0, yaw: 0.0 };
    this.rocket.targetPitchDeg = 88.0;
    this.velocity.vy = Math.max(this.velocity.vy, 6.0);
    this.velocity.vx = Math.max(this.velocity.vx, 8.0);
    this.rocket.status = ROCKET_STATUS.STAGE1_BURN;
    this.rocket.stagingSubPhase = 'PYRO_DROP_CLEAR';
    return {
      success: true,
      reason: this.isInsideSafezone
        ? 'BALLOON SEPARATION & STAGE 1 IGNITION -> Propelling along Projectile Gravity-Turn Trajectory!'
        : 'SBRL Stage 1 Ignited (WARNING: ILLEGAL LAUNCH OUTSIDE APPROVED SAFEZONE).',
    };
  }

  /**
   * Run one integration timestep (dt seconds)
   */
  integrate(dt) {
    if (!this.hasLaunched || !this.isRunning || dt <= 0) return;

    // Range Safety: calculate horizontal drift distance from launch pad origin (0, 0)
    this.currentDriftM = Math.sqrt(this.position.x * this.position.x + this.position.z * this.position.z);
    this.isInsideSafezone = this.currentDriftM <= this.safezoneRadiusM;

    const atmo = calculateAtmosphere(this.position.y, this.env);
    const wind = this.getWindVector(this.position.y);

    // Spherical Earth Gravity & Orbital Centrifugal Acceleration
    const rCurrent = R_EARTH + this.position.y;
    const gLocal = CONSTANTS.g0 * Math.pow(R_EARTH / rCurrent, 2);
    const horizSpeedSq = this.velocity.vx * this.velocity.vx + this.velocity.vz * this.velocity.vz;
    const aCentrifugal = horizSpeedSq / rCurrent;

    if (this.isTetherAttached) {
      this.checkBalloonBurst();

      if (this.isBalloonBurst) {
        this.acceleration.ay = -gLocal;
        this.acceleration.ax = 0;
        this.acceleration.az = 0;
      } else {
        // ================= ASCENT PHASE (BALLOON + ROCKET COUPLED) =================
        const balloonState = this.balloon.getState(this.position.y, this.velocity, this.env, wind);
        const totalSystemMass = balloonState.systemDeadMassKg + this.rocket.getMassKg();

        const fBuoyantY = balloonState.buoyantForceN;
        const fGravityY = totalSystemMass * gLocal;

        const relVy = this.velocity.vy - wind.vy;
        const fDragY = 0.5 * atmo.rho_air * relVy * Math.abs(relVy) * this.balloon.dragCoeff * balloonState.crossSectionAreaM2;

        const relVx = this.velocity.vx - wind.vx;
        const relVz = this.velocity.vz - wind.vz;
        const horizCouplingK = 0.8;
        const fWindDragX = -0.5 * atmo.rho_air * relVx * Math.abs(relVx) * this.balloon.dragCoeff * balloonState.crossSectionAreaM2 * horizCouplingK;
        const fWindDragZ = -0.5 * atmo.rho_air * relVz * Math.abs(relVz) * this.balloon.dragCoeff * balloonState.crossSectionAreaM2 * horizCouplingK;

        this.acceleration.ay = (fBuoyantY - fGravityY - fDragY) / totalSystemMass;
        this.acceleration.ax = fWindDragX / totalSystemMass;
        this.acceleration.az = fWindDragZ / totalSystemMass;

        const tSec = this.timeMs / 1000;
        this.rocket.attitudeRpyDeg.pitch = 90.0 + Math.sin(tSec * 0.9) * (this.env.turbulenceLevel === 'severe' ? 6.0 : 1.5);
        this.rocket.attitudeRpyDeg.roll = Math.cos(tSec * 1.1) * (this.env.turbulenceLevel === 'severe' ? 5.0 : 1.2);
        this.rocket.attitudeRpyDeg.yaw = (this.env.windDirectionDeg + 180 + Math.sin(tSec * 0.3) * 5) % 360;
        this.rocket.updateOrbitalMechanics(this.position.y, this.velocity);
      }
    } else {
      // ================= FREE ROCKET FLIGHT / ORBITAL INSERTION / SUBORBITAL DECAY / FREE FALL =================
      const rocketMass = this.rocket.getMassKg();
      const { thrustN } = this.rocket.computeThrust(atmo.P_pa);
      const aero = this.rocket.computeAero(this.position.y, this.velocity, atmo);

      const isBurning =
        this.rocket.status === ROCKET_STATUS.STAGE1_BURN || this.rocket.status === ROCKET_STATUS.STAGE2_BURN;

      if (isBurning && thrustN > 0) {
        const pitchRad = (this.rocket.attitudeRpyDeg.pitch * Math.PI) / 180;

        const fThrustX = thrustN * Math.cos(pitchRad);
        const fThrustY = thrustN * Math.sin(pitchRad);
        const fThrustZ = 0.0;

        this.acceleration.ax = (fThrustX + aero.dragVector.fx) / rocketMass;
        this.acceleration.ay = (fThrustY + aero.dragVector.fy) / rocketMass - gLocal + aCentrifugal;
        this.acceleration.az = (fThrustZ + aero.dragVector.fz) / rocketMass;

        this.rocket.step(dt, atmo.P_pa, this.position.y, this.velocity);

        if (this.rocket.status === ROCKET_STATUS.LEO_ORBIT) {
          const vCircular = Math.sqrt(gLocal * rCurrent);
          this.velocity.vx = Math.max(this.velocity.vx, vCircular);
          this.velocity.vy = 0.0;
          this.velocity.vz = 0.0;
          this.acceleration.ax = 0.0;
          this.acceleration.ay = 0.0;
          this.acceleration.az = 0.0;
          this.rocket.orbitalVelocityMps = this.velocity.vx;
          this.rocket.updateOrbitalMechanics(this.position.y, this.velocity);
        }
      } else if (this.rocket.status === ROCKET_STATUS.LEO_ORBIT) {
        // ================= STABLE LOW EARTH ORBIT (LEO) =================
        const vCircular = Math.sqrt(gLocal * rCurrent);
        this.velocity.vx = Math.max(this.velocity.vx, vCircular);
        this.velocity.vy = 0.0;
        this.velocity.vz = 0.0;
        this.acceleration.ax = 0.0;
        this.acceleration.ay = 0.0;
        this.acceleration.az = 0.0;
        this.rocket.step(dt, atmo.P_pa, this.position.y, this.velocity);
      } else {
        // ================= UNPOWERED FREE FALL OR FAILED LEO SUBORBITAL DECAY =================
        this.acceleration.ax = aero.dragVector.fx / rocketMass;
        this.acceleration.ay = -gLocal + aCentrifugal + aero.dragVector.fy / rocketMass;
        this.acceleration.az = aero.dragVector.fz / rocketMass;
        this.rocket.step(dt, atmo.P_pa, this.position.y, this.velocity);
      }
    }

    // Numerical integration (Semi-implicit Euler)
    this.velocity.vx += this.acceleration.ax * dt;
    this.velocity.vy += this.acceleration.ay * dt;
    this.velocity.vz += this.acceleration.az * dt;

    this.position.x += this.velocity.vx * dt;
    this.position.y += this.velocity.vy * dt;
    this.position.z += this.velocity.vz * dt;

    // AUTO-THROTTLE SPEED TO 1x AT 34 KM ALTITUDE
    if (this.position.y >= 34000.0 && !this.hasAutoSlowedAt34km) {
      this.timeWarp = 1.0;
      this.hasAutoSlowedAt34km = true;
    }

    // Advance spherical Earth orbital angle (radians)
    if (!this.isTetherAttached) {
      if (this.rocket.status === ROCKET_STATUS.LEO_ORBIT) {
        this.orbitalAngleRad += (this.velocity.vx * dt) / 260000.0;
      } else if (
        this.rocket.status === ROCKET_STATUS.STAGE1_BURN ||
        this.rocket.status === ROCKET_STATUS.STAGE2_BURN ||
        this.rocket.status === ROCKET_STATUS.ORBIT_INSERTION_FAILURE
      ) {
        this.orbitalAngleRad += (this.velocity.vx * dt) / 900000.0;
      }
    }

    // Ground clamp if falling vehicle hits surface
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.vx = 0;
      this.velocity.vy = 0;
      this.velocity.vz = 0;
      this.acceleration.ax = 0;
      this.acceleration.ay = 0;
      this.acceleration.az = 0;
    }

    this.timeMs += dt * 1000;

    // Record 3D Trajectory Track Line
    if (this.timeMs - this.lastTrajectoryRecordTimeMs >= 250) {
      this.lastTrajectoryRecordTimeMs = this.timeMs;
      this.trajectoryPoints.push({
        x: this.position.x,
        y: this.position.y,
        z: this.position.z,
        orbitalAngleRad: this.orbitalAngleRad,
        phase: this.getFlightPhase(),
      });
      if (this.trajectoryPoints.length > 3500) {
        this.trajectoryPoints.shift();
      }
    }

    // Record downlink telemetry sample according to sampleRateHz
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
      this.baroDriftHpa += 0.05 * (Math.random() - 0.4);
      measuredPressureHpa += this.baroDriftHpa;
      baroStatus = 'DEGRADED';
    }

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
      gyroNoiseP += (Math.random() - 0.5) * 12.0 + 3.0;
      gyroNoiseR += (Math.random() - 0.5) * 12.0;
      gyroNoiseY += (Math.random() - 0.5) * 12.0;
    }

    const imuAccel = [
      Number((this.acceleration.ax + accelNoiseX).toFixed(3)),
      Number((this.acceleration.az + accelNoiseZ).toFixed(3)),
      Number((this.acceleration.ay + CONSTANTS.g0 + accelNoiseY).toFixed(3)),
    ];

    const imuGyro = [
      Number((this.rocket.angularRateDps.pitchRate + gyroNoiseP).toFixed(3)),
      Number((this.rocket.angularRateDps.rollRate + gyroNoiseR).toFixed(3)),
      Number((this.rocket.angularRateDps.yawRate + gyroNoiseY).toFixed(3)),
    ];

    const attitudeRpy = [
      Number((this.rocket.attitudeRpyDeg.roll + (this.faults.imuNoise ? (Math.random() - 0.5) * 8 : 0)).toFixed(2)),
      Number((this.rocket.attitudeRpyDeg.pitch + (this.faults.imuNoise ? (Math.random() - 0.5) * 8 : 0)).toFixed(2)),
      Number((this.rocket.attitudeRpyDeg.yaw + (this.faults.imuNoise ? (Math.random() - 0.5) * 8 : 0)).toFixed(2)),
    ];

    // 3. PITOT / AIRSPEED SENSOR
    const relVx = this.velocity.vx - wind.vx;
    const relVy = this.velocity.vy - wind.vy;
    const relVz = this.velocity.vz - wind.vz;
    const trueAirspeed = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz);

    let measuredAirspeed = trueAirspeed + (Math.random() - 0.5) * 0.3;
    let pitotStatus = 'NOMINAL';

    if (this.faults.pitotIcing) {
      pitotStatus = 'FAILED';
      measuredAirspeed = Math.max(0, (Math.random() - 0.5) * 2.0);
    }

    // 4. 3D GNSS COORDINATES (Launch Pad Origin = [0, 0, 0]) & GPS FAULT INJECTION
    let gpsStatus = 'NOMINAL';
    const jX = this.hasLaunched ? (Math.random() - 0.5) * 0.8 : 0.0;
    const jY = this.hasLaunched ? (Math.random() - 0.5) * 1.2 : 0.0;
    const jZ = this.hasLaunched ? (Math.random() - 0.5) * 0.8 : 0.0;

    let gnssX = this.position.x + jX;
    let gnssY = trueAlt + jY;
    let gnssZ = this.position.z + jZ;
    let gpsAlt = gnssY;
    let gpsLat = this.originLat + gnssZ / 111320;
    let gpsLon = this.originLon + gnssX / (111320 * Math.cos((this.originLat * Math.PI) / 180));

    if (this.faults.gpsLoss) {
      gpsStatus = 'FAILED';
      if (Math.random() < 0.4) {
        gpsAlt = null;
        gpsLat = null;
        gpsLon = null;
        gnssX = null;
        gnssY = null;
        gnssZ = null;
      } else {
        const err = (Math.random() - 0.5) * 250;
        gnssX += err;
        gnssY += err;
        gnssZ += err;
        gpsAlt = gnssY;
      }
    }

    const slantRange3dM =
      gnssX !== null && gnssY !== null && gnssZ !== null
        ? Number(Math.sqrt(gnssX * gnssX + gnssY * gnssY + gnssZ * gnssZ).toFixed(2))
        : null;

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
    const balloonState = this.balloon.getState(this.position.y, this.velocity, this.env, wind);
    const { thrustN } = this.rocket.computeThrust(atmo.P_pa);
    const aero = this.rocket.computeAero(this.position.y, this.velocity, atmo);

    const simulationState = {
      status: this.missionStatus, // 'PRELAUNCH' | 'RUNNING' | 'PAUSED' | 'RESUMED'
      is_running: this.isRunning,
      is_paused: this.isPaused,
      is_resumed: this.isResumed,
      last_action: this.lastControlAction,
      pause_count: this.pauseCount,
      resume_count: this.resumeCount,
      last_pause_timestamp_ms: this.lastPauseTimeMs,
      last_resume_timestamp_ms: this.lastResumeTimeMs,
      pause_resume_events: this.pauseResumeEvents,
    };

    return {
      timestamp_ms: Math.round(this.timeMs),
      flight_phase: this.getFlightPhase(),
      simulation_state: simulationState,
      isPacketDropped,
      gnss_coordinates: {
        origin_reference: 'LAUNCH_PAD_ORIGIN [0, 0, 0]',
        position_from_origin_xyz_m: [
          gnssX !== null ? Number(gnssX.toFixed(2)) : null,
          gnssY !== null ? Number(gnssY.toFixed(2)) : null,
          gnssZ !== null ? Number(gnssZ.toFixed(2)) : null,
        ],
        x_downrange_m: gnssX !== null ? Number(gnssX.toFixed(2)) : null,
        y_altitude_m: gnssY !== null ? Number(gnssY.toFixed(2)) : null,
        z_crossrange_m: gnssZ !== null ? Number(gnssZ.toFixed(2)) : null,
        slant_range_3d_m: slantRange3dM,
        geodetic_wgs84: {
          lat_deg: gpsLat !== null ? Number(gpsLat.toFixed(6)) : null,
          lon_deg: gpsLon !== null ? Number(gpsLon.toFixed(6)) : null,
          alt_m: gpsAlt !== null ? Number(gpsAlt.toFixed(2)) : null,
        },
        status: gpsStatus,
      },
      barometric_sensor: {
        pressure_hpa: Number(measuredPressureHpa.toFixed(2)),
        true_altitude_m: Number(trueAlt.toFixed(1)),
        derived_altitude_m: Number(derivedBaroAlt.toFixed(1)),
        status: baroStatus,
      },
      imu_sensor: {
        accel_mps2: imuAccel,
        gyro_dps: imuGyro,
        attitude_rpy_deg: attitudeRpy,
        status: imuStatus,
      },
      environmental_sensors: {
        ambient_temp_c: Number(atmo.T_c.toFixed(1)),
        ambient_pressure_hpa: Number(atmo.P_hpa.toFixed(2)),
        air_density_kgm3: Number(atmo.rho_air.toFixed(4)),
        relative_humidity_pct: Number(atmo.humidityPct.toFixed(1)),
        solar_radiation_wm2: Number(atmo.solarRadiationWm2.toFixed(0)),
        lapse_rate_c_per_km: Number(atmo.lapseRateCPerKm.toFixed(2)),
        wind_shear_mps_per_km: Number((this.env.windShearMpsPerKm || 2.5).toFixed(1)),
        vertical_wind_mps: Number((this.env.verticalWindMps || 0.0).toFixed(2)),
        effective_wind_vector_mps: [
          Number(wind.vx.toFixed(2)),
          Number(wind.vy.toFixed(2)),
          Number(wind.vz.toFixed(2)),
        ],
      },
      payload_state: {
        is_attached: this.isTetherAttached,
        is_balloon_burst: this.isBalloonBurst,
        balloon_burst_reason: this.balloonBurstReason,
        balloon_volume_m3: Number(balloonState.currentVolumeM3.toFixed(1)),
        envelope_stress_pct: balloonState.envelopeStressPct,
        membrane_hoop_stress_mpa: balloonState.membraneHoopStressMPa,
        differential_superpressure_pa: balloonState.differentialSuperpressurePa,
        thrust_n: Number(thrustN.toFixed(1)),
        rocket_status: this.rocket.status,
        staging_sub_phase: this.rocket.stagingSubPhase,
        separation_clearance_m: Number(this.rocket.separationClearanceM.toFixed(1)),
        orbital_velocity_mps: Number(this.rocket.orbitalVelocityMps.toFixed(1)),
        orbital_angle_deg: Number(((this.orbitalAngleRad * 180) / Math.PI % 360).toFixed(1)),
        propellant_kg: Number((this.rocket.currentStage1Propellant + this.rocket.currentStage2Propellant).toFixed(1)),
        total_mass_kg: Number(
          (this.isTetherAttached
            ? balloonState.systemDeadMassKg + this.rocket.getMassKg()
            : this.rocket.getMassKg()
          ).toFixed(1)
        ),
      },
      orbital_and_aerothermal_physics: {
        specific_orbital_energy_mj_kg: Number(this.rocket.specificOrbitalEnergyMJkg.toFixed(3)),
        specific_angular_momentum_m2_s: Number(this.rocket.specificAngularMomentumM2s.toFixed(0)),
        eccentricity: Number(this.rocket.eccentricity.toFixed(4)),
        semi_major_axis_km: Number(this.rocket.semiMajorAxisKm.toFixed(1)),
        apoapsis_km: this.rocket.apoapsisKm,
        periapsis_km: this.rocket.periapsisKm,
        remaining_delta_v_mps: Number(this.rocket.remainingDeltaVMps.toFixed(1)),
        dynamic_pressure_q_pa: Number(aero.dynamicPressurePa.toFixed(2)),
        max_q_pa: Number(this.rocket.maxQPa.toFixed(2)),
        aerodynamic_heat_flux_wm2: Number(aero.aerodynamicHeatFluxWm2.toFixed(1)),
        mach_number: Number(aero.mach.toFixed(2)),
        membrane_hoop_stress_mpa: balloonState.membraneHoopStressMPa,
        differential_superpressure_pa: balloonState.differentialSuperpressurePa,
      },
      range_safety: {
        safezone_radius_m: this.safezoneRadiusM,
        current_drift_m: Number(this.currentDriftM.toFixed(1)),
        is_inside_safezone: this.isInsideSafezone,
        is_illegal_launch: !this.isInsideSafezone,
      },
      navigation_state: {
        gps_altitude_m: gpsAlt !== null ? Number(gpsAlt.toFixed(1)) : null,
        lat: gpsLat !== null ? Number(gpsLat.toFixed(5)) : null,
        lon: gpsLon !== null ? Number(gpsLon.toFixed(5)) : null,
        status: gpsStatus,
        measured_airspeed_mps: Number(measuredAirspeed.toFixed(2)),
        true_airspeed_mps: Number(trueAirspeed.toFixed(2)),
        pitot_status: pitotStatus,
        transceiver_status: transceiverStatus,
      },
    };
  }

  /**
   * Build the JSON packet streamed every 0.5 seconds to 172.16.59.95:65432
   * Includes both the device_handshake/payload structure and full SBRL telemetry + pause/resume state.
   */
  getSocketPayload() {
    const reading = this.generateSensorReadings();
    const statusLabel = this.isPaused
      ? 'paused'
      : this.isResumed
      ? 'resumed'
      : this.isRunning
      ? 'active'
      : 'prelaunch';

    return {
      event: 'device_handshake',
      device_id: 'client_node_01',
      server_target: {
        server_ip: '172.16.59.95',
        port: 65432,
        ping_interval_seconds: 0.5,
      },
      status: statusLabel,
      is_paused: this.isPaused,
      is_resumed: this.isResumed,
      simulation_state: reading.simulation_state,
      payload: {
        temperature: reading.environmental_sensors.ambient_temp_c,
        status: statusLabel,
        is_paused: this.isPaused,
        is_resumed: this.isResumed,
        simulation_state: reading.simulation_state,
        timestamp_ms: reading.timestamp_ms,
        flight_phase: reading.flight_phase,
        gnss_coordinates: reading.gnss_coordinates,
        barometric_sensor: reading.barometric_sensor,
        imu_sensor: reading.imu_sensor,
        environmental_sensors: reading.environmental_sensors,
        payload_state: reading.payload_state,
        orbital_and_aerothermal_physics: reading.orbital_and_aerothermal_physics,
      },
      timestamp_ms: reading.timestamp_ms,
      flight_phase: reading.flight_phase,
      gnss_coordinates: reading.gnss_coordinates,
      barometric_sensor: reading.barometric_sensor,
      imu_sensor: reading.imu_sensor,
      environmental_sensors: reading.environmental_sensors,
      payload_state: reading.payload_state,
      orbital_and_aerothermal_physics: reading.orbital_and_aerothermal_physics,
    };
  }

  /**
   * Record telemetry record to buffer
   */
  recordTelemetryRecord() {
    const reading = this.generateSensorReadings();
    if (!reading.isPacketDropped) {
      this.telemetryBuffer.push(reading);
      if (this.telemetryBuffer.length > this.maxBufferSize) {
        this.telemetryBuffer.shift();
      }
    }
  }

  /**
   * Export telemetry to conformant JSON schema including 3D Launch-Pad-Origin GNSS Coordinates, Pause/Resume State & Physics
   */
  getExportJson() {
    const records = this.telemetryBuffer.map((rec) => ({
      timestamp_ms: rec.timestamp_ms,
      flight_phase: rec.flight_phase,
      simulation_state: rec.simulation_state,
      gnss_coordinates: rec.gnss_coordinates,
      barometric_sensor: {
        pressure_hpa: rec.barometric_sensor.pressure_hpa,
        derived_altitude_m: rec.barometric_sensor.derived_altitude_m,
        status: rec.barometric_sensor.status,
      },
      imu_sensor: {
        accel_mps2: rec.imu_sensor.accel_mps2,
        gyro_dps: rec.imu_sensor.gyro_dps,
        attitude_rpy_deg: rec.imu_sensor.attitude_rpy_deg,
        status: rec.imu_sensor.status,
      },
      environmental_sensors: {
        ambient_temp_c: rec.environmental_sensors.ambient_temp_c,
        relative_humidity_pct: rec.environmental_sensors.relative_humidity_pct,
        effective_wind_vector_mps: rec.environmental_sensors.effective_wind_vector_mps,
      },
      payload_state: {
        is_attached: rec.payload_state.is_attached,
        balloon_volume_m3: rec.payload_state.balloon_volume_m3,
        thrust_n: rec.payload_state.thrust_n,
        staging_sub_phase: rec.payload_state.staging_sub_phase,
      },
      orbital_and_aerothermal_physics: rec.orbital_and_aerothermal_physics,
    }));

    return {
      mission_metadata: {
        platform_name: 'Aeroin SpaceTech SBRL',
        vehicle_configuration: 'Pyramidal Direct-to-Orbit Launch System',
        launch_type: 'Stratospheric Balloon Rocket Launch (36-40 km)',
        firmware_build: 'SBRL-AEROIN-SIM-v2.4',
        gnss_origin_reference: 'Ground Launch Pad [X=0.0m, Y=0.0m, Z=0.0m]',
        active_preset: this.activePresetId,
        sample_rate_hz: this.sampleRateHz,
        total_samples: records.length,
        simulation_state: {
          status: this.missionStatus,
          is_running: this.isRunning,
          is_paused: this.isPaused,
          is_resumed: this.isResumed,
          last_action: this.lastControlAction,
          pause_count: this.pauseCount,
          resume_count: this.resumeCount,
          last_pause_timestamp_ms: this.lastPauseTimeMs,
          last_resume_timestamp_ms: this.lastResumeTimeMs,
          pause_resume_events: this.pauseResumeEvents,
        },
        environment_presets: {
          base_wind_speed_kmh: this.env.windSpeedKmh,
          wind_direction_deg: this.env.windDirectionDeg,
          vertical_wind_mps: this.env.verticalWindMps,
          wind_shear_mps_per_km: this.env.windShearMpsPerKm,
          pressure_scale: this.env.pressureScale,
          temp_delta_c: this.env.tempDeltaC,
          air_density_scale: this.env.airDensityScale,
          turbulence_level: this.env.turbulenceLevel,
          lapse_rate_c_per_km: this.env.lapseRateCPerKm,
          solar_radiation_wm2: this.env.solarRadiationWm2,
          humidity_surface_pct: this.env.surfaceHumidityPct,
        },
      },
      sensor_telemetry_records: records,
    };
  }
}
