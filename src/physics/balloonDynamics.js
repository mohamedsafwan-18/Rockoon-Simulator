// Aeroin SpaceTech SBRL (Stratospheric Balloon Rocket Launcher)
// Ultra-High-Altitude Zero-Pressure Helium Envelope Dynamics (36 km - 40 km Float Envelope)
// Implements structural hoop stress, volume limits, cryogenic embrittlement, and gust shear burst physics.

import { CONSTANTS, calculateAtmosphere } from './isaAtmosphere.js';

export class BalloonSystem {
  constructor(config = {}) {
    // Ultra-lightweight high-tenacity polyethylene film (12-15 microns)
    this.envelopeMassKg = config.envelopeMassKg || 460.0;
    // Aerodynamic tetrahedral/pyramidal cradle truss & rail-release latch
    this.cradleMassKg = config.cradleMassKg || 180.0;
    // Helium gas charge sized for extreme stratospheric float (36 - 40 km)
    this.heliumMassKg = config.heliumMassKg || 680.0;
    // Envelope capacity: rated nominal volume 880,000 m3, structural burst limit 920,000 m3
    this.maxDesignVolumeM3 = config.maxDesignVolumeM3 || 880000.0;
    this.burstVolumeLimitM3 = config.burstVolumeLimitM3 || 920000.0;
    this.initialVolumeM3 = config.initialVolumeM3 || 4200.0;
    this.dragCoeff = config.dragCoeff || 0.42;
    this.tetherLengthM = config.tetherLengthM || 55.0;
    this.burstAltitudeM = config.burstAltitudeM || 41500.0;

    // Operational lifecycle flags
    this.isCutDown = false;
    this.isBurst = false;
    this.burstReason = null;
    this.isVenting = false;
  }

  /**
   * Evaluate structural integrity of the zero-pressure polyethylene envelope
   * against sandbox environmental variables and aerodynamic flight vectors.
   */
  checkBurst(altitudeM, envParams = {}, velocityVector = { vx: 0, vy: 0, vz: 0 }, windVector = { vx: 0, vy: 0, vz: 0 }) {
    if (this.isBurst || this.isCutDown) return { isBurst: this.isBurst, reason: this.burstReason };

    const atmo = calculateAtmosphere(altitudeM, envParams);
    const pressureScale = envParams.pressureScale !== undefined ? envParams.pressureScale : 1.0;

    // THRESHOLD A: Decompression Over-Expansion / Burst Altitude Rupture
    // Under normal pressure, zero-pressure appendix vents excess gas at float ceiling (~38.4 km).
    // However, if ambient pressure scale drops < 0.88x or altitude exceeds 41.5 km, decompression outpaces appendix venting and ruptures the film!
    if ((pressureScale < 0.88 && altitudeM >= 10000) || altitudeM >= this.burstAltitudeM) {
      this.isBurst = true;
      this.burstReason = `ENVELOPE OVER-EXPANSION RUPTURE: Low ambient pressure scale (${pressureScale.toFixed(2)}x, ${atmo.P_hpa.toFixed(2)} hPa) exceeded appendix venting rate and ruptured the 920,000 m³ envelope!`;
      return { isBurst: true, reason: this.burstReason };
    }

    // THRESHOLD B: Severe Jet Stream Turbulence & Dynamic Shear Tearing
    // Note: Wind speed alone (calm/mild) simply drifts the balloon, but severe turbulence combined with wind speed >= 95 km/h tears the 15-micron film!
    const windSpeedKmh = envParams.windSpeedKmh || 45.0;
    const turbulence = envParams.turbulenceLevel || 'mild';
    const relVx = velocityVector.vx - (windVector.vx || 0);
    const relVz = velocityVector.vz - (windVector.vz || 0);
    const relHorizSpeed = Math.sqrt(relVx * relVx + relVz * relVz);

    if (turbulence === 'severe' && (windSpeedKmh >= 95.0 || relHorizSpeed >= 28.0) && altitudeM >= 3500) {
      this.isBurst = true;
      this.burstReason = `AERODYNAMIC SHEAR FAILURE: Severe jet stream turbulence gusts (${windSpeedKmh} km/h) tore the 15-micron polyethylene envelope fabric!`;
      return { isBurst: true, reason: this.burstReason };
    }

    // THRESHOLD C: Cryogenic Glass-Transition Embrittlement
    // Polyethylene glass transition occurs below -78°C (195 K). Severe negative Temp Delta at tropopause shatters fabric.
    if (atmo.T_c <= -78.0 && altitudeM >= 7000) {
      this.isBurst = true;
      this.burstReason = `CRYOGENIC EMBRITTLEMENT: Ambient temperature (${atmo.T_c.toFixed(1)}°C) dropped below -78°C glass-transition threshold, shattering the film under vibration.`;
      return { isBurst: true, reason: this.burstReason };
    }

    return { isBurst: false, reason: null };
  }

  /**
   * Calculate balloon physical state at a given altitude
   */
  getState(altitudeM, velocityVector = { vx: 0, vy: 0, vz: 0 }, envParams = {}, windVector = { vx: 0, vy: 0, vz: 0 }) {
    const atmo = calculateAtmosphere(altitudeM, envParams);

    // Re-check structural rupture
    this.checkBurst(altitudeM, envParams, velocityVector, windVector);

    // Gas expansion via Ideal Gas Law: P * V / T = n * R
    let theoreticalVolume = (this.heliumMassKg / CONSTANTS.M_he) * CONSTANTS.R_gas * atmo.T_k / atmo.P_pa;

    // Cap at zero-pressure venting capacity at float ceiling (~38-40 km)
    const isAtFloatLimit = theoreticalVolume >= this.maxDesignVolumeM3;
    const currentVolume = Math.min(this.maxDesignVolumeM3, theoreticalVolume);

    // Equivalent spherical radius
    const radiusM = Math.cbrt((3 * currentVolume) / (4 * Math.PI));
    const crossSectionAreaM2 = Math.PI * radiusM * radiusM;

    // Envelope stress ratio (% of burst limit)
    const envelopeStressPct = Math.min(100, Math.round((theoreticalVolume / this.burstVolumeLimitM3) * 100));

    // Dynamic morphing: tall slender teardrop at sea level -> colossal pumpkin envelope at 38 km
    const inflationRatio = Math.min(1.0, currentVolume / this.maxDesignVolumeM3);
    const aspectHeightToWidth = 3.8 - 2.8 * inflationRatio;

    // Archimedes Buoyant Lift: F_b = (rho_air - rho_he) * Volume * g
    // If balloon is burst or tether cut down, buoyant force is ZERO
    const netGasLiftPerM3 = Math.max(0, atmo.rho_air - atmo.rho_he);
    const buoyantForceN = (this.isCutDown || this.isBurst) ? 0 : netGasLiftPerM3 * currentVolume * CONSTANTS.g0;

    // Aerodynamic Drag: F_d = 0.5 * rho_air * v_rel^2 * Cd * Area
    const verticalSpeed = velocityVector.vy || 0;
    const dragForceY = 0.5 * atmo.rho_air * Math.abs(verticalSpeed) * verticalSpeed * this.dragCoeff * crossSectionAreaM2;

    // Total dead mass of balloon + tetrahedral cradle + helium
    const systemDeadMassKg = this.envelopeMassKg + this.cradleMassKg + this.heliumMassKg;

    return {
      altitudeM,
      currentVolumeM3: currentVolume,
      theoreticalVolumeM3: theoreticalVolume,
      radiusM,
      inflationRatio,
      aspectHeightToWidth,
      crossSectionAreaM2,
      envelopeStressPct,
      buoyantForceN,
      dragForceY,
      systemDeadMassKg,
      isAtFloatLimit,
      isBurst: this.isBurst,
      burstReason: this.burstReason,
      atmo
    };
  }
}
