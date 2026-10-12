// Comprehensive Automated Test Suite for Virtual Labs Aeroin SpaceTech SBRL Simulator
import { calculateAtmosphere, pressureToAltitude, CONSTANTS } from './src/physics/isaAtmosphere.js';
import { BalloonSystem } from './src/physics/balloonDynamics.js';
import { SbrlPyramidalRocket, ROCKET_STATUS } from './src/physics/rocketDynamics.js';
import { SimulationKernel, FLIGHT_PHASES } from './src/physics/simulationKernel.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('================================================================');
console.log('🧪 RUNNING COMPREHENSIVE TEST SUITE: AEROIN SBRL SIMULATOR');
console.log('================================================================\n');

// -------------------------------------------------------------
// TEST SUITE 1: ISA ATMOSPHERIC MODEL (0 TO 40 KM)
// -------------------------------------------------------------
console.log('--- TEST SUITE 1: ISA Atmosphere Profile & Closed-Form Inversion ---');
{
  const atmo0 = calculateAtmosphere(0);
  assert(Math.abs(atmo0.P_hpa - 1013.25) < 0.1, 'Sea level pressure is 1013.25 hPa');
  assert(Math.abs(atmo0.T_c - 15.0) < 0.1, 'Sea level temperature is 15.0 °C');
  assert(Math.abs(atmo0.rho_air - 1.225) < 0.01, 'Sea level air density is ~1.225 kg/m3');

  const atmo11 = calculateAtmosphere(11000);
  assert(Math.abs(atmo11.T_c - (-56.5)) < 0.2, 'Tropopause (11 km) temperature is -56.5 °C');
  assert(Math.abs(atmo11.P_hpa - 226.3) < 2.0, 'Tropopause pressure is ~226.3 hPa');

  const atmo36 = calculateAtmosphere(36000);
  assert(atmo36.P_hpa >= 3.5 && atmo36.P_hpa <= 5.5, 'SBRL Lower Float Window (36 km) pressure is ~4.8 hPa');
  assert(atmo36.T_c > -45.0, 'Stratospheric ozone warming present at 36 km');

  const atmo38 = calculateAtmosphere(38000);
  assert(atmo38.P_hpa >= 3.0 && atmo38.P_hpa <= 4.5, 'SBRL Nominal Float (38 km) pressure is ~3.7 hPa');

  const atmo40 = calculateAtmosphere(40000);
  assert(atmo40.P_hpa >= 2.0 && atmo40.P_hpa <= 3.5, 'SBRL Upper Float Window (40 km) pressure is ~2.8 hPa');

  // Verify Barometric Pressure Inversion across all key altitudes
  [0, 5000, 11000, 20000, 36000, 38000, 40000].forEach((testAlt) => {
    const atmo = calculateAtmosphere(testAlt);
    const derivedAlt = pressureToAltitude(atmo.P_hpa);
    assert(Math.abs(derivedAlt - testAlt) < 0.05, `Barometric altitude inversion at ${testAlt} m (error: ${Math.abs(derivedAlt - testAlt).toFixed(3)} m)`);
  });
}

// -------------------------------------------------------------
// TEST SUITE 2: ZERO-PRESSURE BALLOON EXPANSION & BUOYANCY
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 2: Balloon Buoyancy & Expansion (36-40 km Envelope) ---');
{
  const balloon = new BalloonSystem();
  const state0 = balloon.getState(0);
  const state38 = balloon.getState(38000);

  assert(state0.buoyantForceN > 35000, `Sea level buoyant lift is positive: ${(state0.buoyantForceN / 1000).toFixed(1)} kN`);
  assert(state38.currentVolumeM3 > 500000, `Balloon expands massively at 38 km near-vacuum: ${state38.currentVolumeM3.toFixed(0)} m3`);
  assert(state38.inflationRatio > 0.7, 'Inflation ratio near float ceiling exceeds 70%');
}

// -------------------------------------------------------------
// TEST SUITE 3: VEHICLE GROUND LIFECYCLE (START, FREEZE, RESUME, RESTART)
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 3: Ground Launch & Simulation Lifecycle (Freeze/Resume/Restart) ---');
{
  const kernel = new SimulationKernel();

  // Initially resting on pad
  assert(kernel.hasLaunched === false, 'Vehicle hasLaunched is false initially');
  assert(kernel.isRunning === false, 'Vehicle isRunning is false initially');
  assert(kernel.position.y === 0.0, 'Vehicle starts at ground altitude 0 m');
  assert(kernel.timeMs === 0, 'Mission Elapsed Time starts at 0 ms');
  assert(kernel.telemetryBuffer.length === 0, 'Telemetry buffer starts empty');

  // Integrating while unlaunched must do nothing
  kernel.integrate(1.0);
  assert(kernel.position.y === 0.0, 'Position remains 0 m before launch trigger');
  assert(kernel.timeMs === 0, 'MET remains 0 ms before launch trigger');
  assert(kernel.telemetryBuffer.length === 0, 'No telemetry recorded before launch trigger');

  // Trigger Launch
  kernel.startMission();
  assert(kernel.hasLaunched === true, 'Mission has launched');
  assert(kernel.isRunning === true, 'Simulation is running');

  // Integrate for 15 seconds
  for (let i = 0; i < 15; i++) kernel.integrate(1.0);
  assert(kernel.position.y > 50.0, `Vehicle ascending smoothly: altitude is ${kernel.position.y.toFixed(1)} m`);
  assert(kernel.velocity.vy > 5.0, `Ascent rate is steady: vy = ${kernel.velocity.vy.toFixed(2)} m/s`);
  assert(kernel.timeMs === 15000, `MET advanced accurately to 15,000 ms`);
  assert(kernel.telemetryBuffer.length > 0, `Telemetry recorded: ${kernel.telemetryBuffer.length} frames`);

  // STOP / FREEZE TEST
  const frozenAlt = kernel.position.y;
  const frozenMet = kernel.timeMs;
  const frozenBufLen = kernel.telemetryBuffer.length;
  kernel.pauseMission();
  assert(kernel.isRunning === false, 'Simulation successfully paused / frozen');

  // Step 20 times during freeze: must NOT advance
  for (let i = 0; i < 20; i++) kernel.integrate(1.0);
  assert(kernel.position.y === frozenAlt, `Altitude frozen exactly at ${frozenAlt.toFixed(2)} m`);
  assert(kernel.timeMs === frozenMet, `MET frozen exactly at ${frozenMet} ms`);
  assert(kernel.telemetryBuffer.length === frozenBufLen, `Telemetry buffer length frozen at ${frozenBufLen} frames`);

  // RESUME TEST
  kernel.resumeMission();
  assert(kernel.isRunning === true, 'Simulation successfully resumed');
  for (let i = 0; i < 10; i++) kernel.integrate(1.0);
  assert(kernel.position.y > frozenAlt, `Vehicle resumed ascent: altitude is ${kernel.position.y.toFixed(1)} m`);
  assert(kernel.timeMs === frozenMet + 10000, `MET resumed accurately to ${kernel.timeMs} ms`);

  // RESTART TO PAD TEST
  kernel.reset();
  assert(kernel.hasLaunched === false, 'Vehicle hasLaunched reset to false');
  assert(kernel.isRunning === false, 'Vehicle isRunning reset to false');
  assert(kernel.position.y === 0.0, 'Altitude reset to 0 m');
  assert(kernel.timeMs === 0, 'MET reset to 0 ms');
  assert(kernel.telemetryBuffer.length === 0, 'Telemetry buffer reset to 0');
}

// -------------------------------------------------------------
// TEST SUITE 4: GROUND-TO-STRATOSPHERE (36-40 KM) TO LEO ORBIT INSERTION
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 4: Stratospheric Launch to Low Earth Orbit (LEO) ---');
{
  const kernel = new SimulationKernel();
  kernel.startMission();

  // Traverse through troposphere, jet stream, and stratosphere up to float window
  for (let i = 0; i < 4800; i++) {
    kernel.integrate(1.0);
  }

  assert(kernel.position.y >= 36000 && kernel.position.y <= 40500, `Vehicle reached 36-40 km window: ${kernel.position.y.toFixed(1)} m`);
  assert(kernel.getFlightPhase() === FLIGHT_PHASES.SBRL_RELEASE_WINDOW, `Flight phase is SBRL_RELEASE_WINDOW (${kernel.getFlightPhase()})`);

  // Test Safety Interlock
  const lowAltKernel = new SimulationKernel();
  lowAltKernel.startMission();
  lowAltKernel.position.y = 15000;
  const prematureIgnition = lowAltKernel.triggerIgnition();
  assert(prematureIgnition.success === false, 'Safety interlock blocked premature ignition below 36,000 m');

  // Staging at float window: cut down and ignite Stage 1
  kernel.triggerCutDown();
  const ignitionRes = kernel.triggerIgnition();
  assert(ignitionRes.success === true, 'Stage 1 Ignition confirmed at 36-40 km');
  assert(kernel.rocket.status === ROCKET_STATUS.STAGE1_BURN, 'Rocket is in STAGE1_BURN mode');

  // Burn Stage 1 for 44 seconds
  for (let i = 0; i < 44; i++) {
    kernel.integrate(1.0);
  }

  assert(kernel.rocket.isStage1Jettisoned === true, 'Stage 1 booster core successfully jettisoned');
  assert(kernel.rocket.status === ROCKET_STATUS.STAGE2_BURN, 'Interstage separation triggered Stage 2 ignition');

  // Burn Stage 2 to achieve orbital insertion (55 seconds)
  for (let i = 0; i < 55; i++) {
    kernel.integrate(1.0);
  }

  assert(kernel.position.y >= 160000, `Vehicle reached LEO altitude: ${(kernel.position.y / 1000).toFixed(1)} km`);
  assert(kernel.rocket.orbitalVelocityMps >= 7700, `Vehicle achieved orbital velocity: ${kernel.rocket.orbitalVelocityMps.toFixed(1)} m/s`);
  assert(kernel.rocket.status === ROCKET_STATUS.LEO_ORBIT, 'Vehicle successfully inserted into LEO_ORBIT');
  assert(kernel.getFlightPhase() === FLIGHT_PHASES.LEO_ORBIT, 'Flight phase is LEO_ORBIT');

  // Verify circular orbit stability (coast for 20 seconds in LEO)
  const leoAlt = kernel.position.y;
  for (let i = 0; i < 20; i++) {
    kernel.integrate(1.0);
  }
  assert(Math.abs(kernel.position.y - leoAlt) < 0.1, `Circular LEO altitude remains rock-steady during orbit: ${(leoAlt / 1000).toFixed(1)} km`);
  assert(kernel.velocity.vy === 0.0, 'Vertical velocity circularized to 0.0 m/s');

  // Verify 3D Trajectory Track Line points recorded
  assert(kernel.trajectoryPoints.length > 50, `3D Trajectory line trace recorded: ${kernel.trajectoryPoints.length} points`);
}

// -------------------------------------------------------------
// TEST SUITE 5: BALLOON BURST & PHYSICS THRESHOLDS
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 5: Balloon Burst Physics & Thresholds ---');
{
  // Test 5A: Low Pressure Scale (< 0.88x) causes over-expansion burst at float altitude
  const kernelBurstA = new SimulationKernel();
  kernelBurstA.startMission();
  kernelBurstA.position.y = 38000; // Float altitude
  kernelBurstA.setEnvParam('pressureScale', 0.84); // Low ambient pressure scale
  assert(kernelBurstA.isBalloonBurst === true, 'Balloon burst triggered by low pressure over-expansion');
  assert(kernelBurstA.isTetherAttached === false, 'Tether disconnected upon burst');

  // Test 5B: High Wind Speed ALONE does NOT burst the balloon
  const kernelWind = new SimulationKernel();
  kernelWind.startMission();
  kernelWind.position.y = 10000;
  kernelWind.setEnvParam('windSpeedKmh', 110.0);
  kernelWind.setEnvParam('turbulenceLevel', 'mild');
  kernelWind.integrate(2.0);
  assert(kernelWind.isBalloonBurst === false, 'Pure high wind speed without severe turbulence does NOT burst balloon');

  // Test 5C: Severe Turbulence combined with Wind >= 95 km/h tears envelope
  const kernelBurstC = new SimulationKernel();
  kernelBurstC.startMission();
  kernelBurstC.position.y = 10000; // In jet stream
  kernelBurstC.setEnvParam('windSpeedKmh', 105.0);
  kernelBurstC.setEnvParam('turbulenceLevel', 'severe');
  kernelBurstC.integrate(2.0);
  assert(kernelBurstC.isBalloonBurst === true, 'Severe turbulence gusts tore envelope fabric');

  // Test 5D: Cryogenic Embrittlement at Tropopause (Temp Delta <= -28°C)
  const kernelBurstD = new SimulationKernel();
  kernelBurstD.startMission();
  kernelBurstD.position.y = 11000; // Tropopause
  kernelBurstD.setEnvParam('tempDeltaC', -29.0);
  kernelBurstD.integrate(1.0);
  assert(kernelBurstD.isBalloonBurst === true, 'Cryogenic embrittlement burst below -78°C glass transition');

  // Test 5E: Rocket Plunges in Free Fall when Balloon Bursts
  const kernelFall = new SimulationKernel();
  kernelFall.startMission();
  kernelFall.position.y = 8000;
  kernelFall.triggerBalloonBurst('Test burst');
  assert(kernelFall.isBalloonBurst === true, 'Balloon burst flag set');
  const preFallY = kernelFall.position.y;
  for (let i = 0; i < 15; i++) kernelFall.integrate(1.0);
  assert(kernelFall.position.y < preFallY, `Rocket falling rapidly under gravity: alt is ${kernelFall.position.y.toFixed(1)} m`);
  assert(kernelFall.velocity.vy < -20.0, `Downward velocity confirmed: vy = ${kernelFall.velocity.vy.toFixed(1)} m/s`);
  assert(kernelFall.getFlightPhase() === FLIGHT_PHASES.BALLOON_BURST, 'Flight phase is BALLOON_BURST');
}

// -------------------------------------------------------------
// TEST SUITE 6: RANGE SAFETY SAFEZONE & ILLEGAL ROCKET LAUNCH
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 6: Range Safety Safezone (35 km) & Illegal Launch ---');
{
  const kernelSafe = new SimulationKernel();
  kernelSafe.startMission();
  kernelSafe.position.y = 38000;
  kernelSafe.position.x = 12000; // 12 km drift (inside 35 km)
  kernelSafe.integrate(0.1);

  assert(kernelSafe.isInsideSafezone === true, 'Vehicle inside 35 km safezone is flagged nominal');

  // Drift beyond 35 km safezone boundary
  kernelSafe.position.x = 38000; // 38 km drift (> 35 km)
  kernelSafe.integrate(0.1);

  assert(kernelSafe.isInsideSafezone === false, 'Vehicle outside 35 km boundary flags airspace violation');

  // Attempt ignition outside safezone without override
  const blockedIgnition = kernelSafe.triggerIgnition();
  assert(blockedIgnition.success === false, 'Ignition outside safezone blocked as ILLEGAL ROCKET LAUNCH');
  assert(blockedIgnition.reason.includes('ILLEGAL ROCKET LAUNCH'), 'Reason specifies ILLEGAL ROCKET LAUNCH');

  // Override allows launch
  kernelSafe.safetyOverride = true;
  const overrideIgnition = kernelSafe.triggerIgnition();
  assert(overrideIgnition.success === true, 'Safety override permits launch with airspace warning');
}

// -------------------------------------------------------------
// TEST SUITE 7: SENSOR FAULT INJECTION ENGINE
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 7: Sensor Fault Injection Modes ---');
{
  const kernel = new SimulationKernel();
  kernel.startMission();
  kernel.position.y = 12000;
  kernel.velocity.vy = 6.0;
  kernel.velocity.vx = 20.0;

  // 1. Barometer Sticking
  kernel.faults.baroStick = true;
  const stuckReading1 = kernel.generateSensorReadings();
  kernel.position.y += 1500;
  const stuckReading2 = kernel.generateSensorReadings();
  assert(stuckReading2.barometric_sensor.status === 'FAILED', 'Barometer stuck status flagged as FAILED');
  assert(Math.abs(stuckReading2.barometric_sensor.pressure_hpa - stuckReading1.barometric_sensor.pressure_hpa) < 0.25, 'Stuck pressure reading remains constant despite 1,500 m altitude change');

  // 2. Pitot Icing
  kernel.faults.pitotIcing = true;
  const icingReading = kernel.generateSensorReadings();
  assert(icingReading.navigation_state.pitot_status === 'FAILED', 'Pitot icing status flagged as FAILED');
  assert(icingReading.navigation_state.measured_airspeed_mps < 2.0, 'Pitot iced reading clogged near zero m/s');

  // 3. IMU Noise
  kernel.faults.imuNoise = true;
  const noisyReading = kernel.generateSensorReadings();
  assert(noisyReading.imu_sensor.status === 'FAILED', 'IMU noise status flagged as FAILED');

  // 4. GPS Dropout
  kernel.faults.gpsLoss = true;
  const gpsReading = kernel.generateSensorReadings();
  assert(gpsReading.navigation_state.status === 'FAILED', 'GPS dropout status flagged as FAILED');
  assert(gpsReading.navigation_state.gps_altitude_m === null || Math.abs(gpsReading.navigation_state.gps_altitude_m - kernel.position.y) > 2.0, 'GPS fix drops to null or experiences severe jitter on lock loss');

  // 5. Telemetry Frame Loss
  kernel.faults.telemetryDrop = true;
  const frameDropReading = kernel.generateSensorReadings();
  assert(frameDropReading.navigation_state.transceiver_status === 'DEGRADED', 'RF transceiver status flagged as DEGRADED');
}

// -------------------------------------------------------------
// TEST SUITE 8: TELEMETRY JSON SCHEMA SPECIFICATION CONFORMANCE
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 8: JSON Export Schema & Aeroin Metadata Conformance ---');
{
  const kernel = new SimulationKernel();
  kernel.startMission();

  for (let i = 0; i < 20; i++) {
    kernel.integrate(0.1);
  }

  const exportData = kernel.getExportJson();
  const meta = exportData.mission_metadata;

  assert(meta.platform_name === "Aeroin SpaceTech SBRL", 'Metadata platform_name is "Aeroin SpaceTech SBRL"');
  assert(meta.vehicle_configuration === "Pyramidal Direct-to-Orbit Launch System", 'Metadata vehicle_configuration verified');
  assert(meta.launch_type === "Stratospheric Balloon Rocket Launch (36-40 km)", 'Metadata launch_type verified');
  assert(meta.firmware_build === "SBRL-AEROIN-SIM-v2.4", 'Metadata firmware_build is "SBRL-AEROIN-SIM-v2.4"');
  assert(meta.sample_rate_hz === 10, 'Metadata sample_rate_hz is 10 Hz');
  assert(meta.total_samples === exportData.sensor_telemetry_records.length, 'total_samples matches record array length');
  assert(exportData.sensor_telemetry_records.length > 0, 'Telemetry records generated successfully');

  const sample = exportData.sensor_telemetry_records[0];
  assert(typeof sample.timestamp_ms === 'number', 'sample has numeric timestamp_ms');
  assert(typeof sample.flight_phase === 'string', 'sample has flight_phase string');
  assert(typeof sample.barometric_sensor.pressure_hpa === 'number', 'sample has barometric_sensor.pressure_hpa');
  assert(typeof sample.barometric_sensor.derived_altitude_m === 'number', 'sample has barometric_sensor.derived_altitude_m');
  assert(Array.isArray(sample.imu_sensor.accel_mps2) && sample.imu_sensor.accel_mps2.length === 3, 'sample has imu_sensor.accel_mps2 array [x,y,z]');
  assert(Array.isArray(sample.imu_sensor.gyro_dps) && sample.imu_sensor.gyro_dps.length === 3, 'sample has imu_sensor.gyro_dps array');
  assert(Array.isArray(sample.imu_sensor.attitude_rpy_deg) && sample.imu_sensor.attitude_rpy_deg.length === 3, 'sample has imu_sensor.attitude_rpy_deg array');
  assert(typeof sample.environmental_sensors.ambient_temp_c === 'number', 'sample has environmental_sensors.ambient_temp_c');
  assert(typeof sample.environmental_sensors.relative_humidity_pct === 'number', 'sample has environmental_sensors.relative_humidity_pct');
  assert(Array.isArray(sample.environmental_sensors.effective_wind_vector_mps), 'sample has effective_wind_vector_mps');
  assert(typeof sample.payload_state.is_attached === 'boolean', 'sample has payload_state.is_attached boolean');
  assert(typeof sample.payload_state.balloon_volume_m3 === 'number', 'sample has payload_state.balloon_volume_m3');
  assert(typeof sample.payload_state.thrust_n === 'number', 'sample has payload_state.thrust_n');
}

console.log('\n================================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('================================================================');
