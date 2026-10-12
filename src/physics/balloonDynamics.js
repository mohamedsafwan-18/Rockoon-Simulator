// Aeroin SpaceTech SBRL (Stratospheric Balloon Rocket Launcher)
// Ultra-High-Altitude Zero-Pressure Helium Envelope Dynamics (36 km - 40 km Float Envelope)

import { CONSTANTS, calculateAtmosphere } from './isaAtmosphere.js';

export class BalloonSystem {
  constructor(config = {}) {
    // Ultra-lightweight high-tenacity polyethylene film (12-15 microns)
    this.envelopeMassKg = config.envelopeMassKg || 460.0;
    // Aerodynamic tetrahedral/pyramidal cradle truss & rail-release latch
    this.cradleMassKg = config.cradleMassKg || 180.0;
    // Helium gas charge sized for extreme stratospheric float (36 - 40 km)
    this.heliumMassKg = config.heliumMassKg || 680.0;
    // Massive envelope capacity to allow expansion under < 3 hPa near-vacuum
    this.maxDesignVolumeM3 = config.maxDesignVolumeM3 || 880000.0;
    this.initialVolumeM3 = config.initialVolumeM3 || 4200.0;
    this.dragCoeff = config.dragCoeff || 0.42;
    this.tetherLengthM = config.tetherLengthM || 55.0;
    this.burstAltitudeM = config.burstAltitudeM || 43000.0;
    this.isCutDown = false;
    this.isVenting = false;
  }

  /**
   * Calculate balloon physical state at a given altitude
   */
  getState(altitudeM, velocityVector = { vx: 0, vy: 0, vz: 0 }, envParams = {}) {
    const atmo = calculateAtmosphere(altitudeM, envParams);

    // Gas expansion via Ideal Gas Law: P * V / T = n * R
    // Under < 3 hPa near-vacuum conditions at 36-40 km, the gas expands by > 300x
    let theoreticalVolume = (this.heliumMassKg / CONSTANTS.M_he) * CONSTANTS.R_gas * atmo.T_k / atmo.P_pa;

    // Cap at zero-pressure venting capacity at float ceiling (~38-40 km)
    const isAtFloatLimit = theoreticalVolume >= this.maxDesignVolumeM3;
    const currentVolume = Math.min(this.maxDesignVolumeM3, theoreticalVolume);

    // Equivalent spherical radius
    const radiusM = Math.cbrt((3 * currentVolume) / (4 * Math.PI));
    const crossSectionAreaM2 = Math.PI * radiusM * radiusM;

    // Dynamic morphing: tall slender teardrop at sea level -> colossal pumpkin envelope at 38 km
    const inflationRatio = Math.min(1.0, currentVolume / this.maxDesignVolumeM3);
    const aspectHeightToWidth = 3.8 - 2.8 * inflationRatio;

    // Archimedes Buoyant Lift: F_b = (rho_air - rho_he) * Volume * g
    const netGasLiftPerM3 = Math.max(0, atmo.rho_air - atmo.rho_he);
    const buoyantForceN = this.isCutDown ? 0 : netGasLiftPerM3 * currentVolume * CONSTANTS.g0;

    // Aerodynamic Drag: F_d = 0.5 * rho_air * v_rel^2 * Cd * Area
    const verticalSpeed = velocityVector.vy || 0;
    const dragForceY = 0.5 * atmo.rho_air * Math.abs(verticalSpeed) * verticalSpeed * this.dragCoeff * crossSectionAreaM2;

    // Total dead mass of balloon + tetrahedral cradle + helium
    const systemDeadMassKg = this.envelopeMassKg + this.cradleMassKg + this.heliumMassKg;

    return {
      altitudeM,
      currentVolumeM3: currentVolume,
      radiusM,
      inflationRatio,
      aspectHeightToWidth,
      crossSectionAreaM2,
      buoyantForceN,
      dragForceY,
      systemDeadMassKg,
      isAtFloatLimit,
      atmo
    };
  }
}
