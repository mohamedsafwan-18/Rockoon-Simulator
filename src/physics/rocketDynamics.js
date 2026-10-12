// Aeroin SpaceTech SBRL (Stratospheric Balloon Rocket Launcher)
// Pyramidal Direct-to-Orbit Launch System Architecture
// Features faceted pyramidal aerodynamic airframe, low supersonic wave drag,
// rail release mechanics, and vacuum nozzle expansion at 36-40 km.

import { CONSTANTS } from './isaAtmosphere.js';

export const ROCKET_STATUS = {
  SLUNG: 'SLUNG',
  ARMED: 'ARMED',
  RAIL_RELEASE: 'RAIL_RELEASE',
  SEPARATED: 'SEPARATED',
  STAGE1_BURN: 'STAGE1_BURN',
  STAGE2_BURN: 'STAGE2_BURN',
  COAST: 'COAST'
};

export class SbrlPyramidalRocket {
  constructor(config = {}) {
    // Stage 1 (Faceted Pyramidal Booster Core)
    this.stage1DryMassKg = config.stage1DryMassKg || 320.0;
    this.stage1PropellantKg = config.stage1PropellantKg || 1480.0;
    this.stage1ThrustVacN = config.stage1ThrustVacN || 38000.0;
    this.stage1IspVacS = config.stage1IspVacS || 342.0;
    this.stage1BurnTimeMaxS = config.stage1BurnTimeMaxS || 55.0;

    // Stage 2 (Internal Upper Stage Core)
    this.stage2DryMassKg = config.stage2DryMassKg || 95.0;
    this.stage2PropellantKg = config.stage2PropellantKg || 420.0;
    this.stage2ThrustVacN = config.stage2ThrustVacN || 11200.0;
    this.stage2IspVacS = config.stage2IspVacS || 360.0;
    this.stage2BurnTimeMaxS = config.stage2BurnTimeMaxS || 50.0;

    // Direct-to-Orbit Payload Module
    this.payloadMassKg = config.payloadMassKg || 65.0;

    // Current Flight State
    this.status = ROCKET_STATUS.SLUNG;
    this.currentStage1Propellant = this.stage1PropellantKg;
    this.currentStage2Propellant = this.stage2PropellantKg;
    this.stage1BurnElapsed = 0;
    this.stage2BurnElapsed = 0;

    // Aerodynamic Geometry: Faceted Pyramidal Airframe
    // Base width 1.3m, height 4.8m -> Low frontal cross-section & sharp leading edges
    this.baseWidthM = 1.35;
    this.heightM = 4.8;
    this.frontalAreaM2 = Math.pow(this.baseWidthM, 2); // Square/faceted base
    this.baseCd = 0.19; // Low wave-drag faceted pyramidal profile

    // Orientation: pitch (deg above horizontal, 90 = vertical up), roll, yaw
    this.attitudeRpyDeg = { roll: 0.0, pitch: 90.0, yaw: 0.0 };
    this.angularRateDps = { rollRate: 0.0, pitchRate: 0.0, yawRate: 0.0 };
    this.targetPitchDeg = 90.0;

    // Forward-rail release separation speed
    this.railSlideProgressM = 0.0;
  }

  /**
   * Current total mass of the SBRL launch vehicle
   */
  getMassKg() {
    let m = this.payloadMassKg;

    // Stage 2 mass
    m += this.stage2DryMassKg + this.currentStage2Propellant;

    // Stage 1 mass (if still attached)
    if (this.status !== ROCKET_STATUS.STAGE2_BURN && this.status !== ROCKET_STATUS.COAST) {
      m += this.stage1DryMassKg + this.currentStage1Propellant;
    }

    return m;
  }

  /**
   * Compute thrust and mass flow rate based on current stage and near-vacuum pressure
   */
  computeThrust(ambientPressurePa) {
    if (this.status === ROCKET_STATUS.STAGE1_BURN) {
      if (this.currentStage1Propellant <= 0) {
        return { thrustN: 0, mdotKgPerS: 0, currentStage: 1 };
      }
      // At 36-40 km (< 3 hPa), vacuum expansion is near 99.8% optimal!
      const pRatio = Math.max(0, 1 - (ambientPressurePa / CONSTANTS.P0_std) * 0.05);
      const thrustN = this.stage1ThrustVacN * pRatio;
      const mdotKgPerS = this.stage1ThrustVacN / (this.stage1IspVacS * CONSTANTS.g0);
      return { thrustN, mdotKgPerS, currentStage: 1 };
    }

    if (this.status === ROCKET_STATUS.STAGE2_BURN) {
      if (this.currentStage2Propellant <= 0) {
        return { thrustN: 0, mdotKgPerS: 0, currentStage: 2 };
      }
      const thrustN = this.stage2ThrustVacN;
      const mdotKgPerS = this.stage2ThrustVacN / (this.stage2IspVacS * CONSTANTS.g0);
      return { thrustN, mdotKgPerS, currentStage: 2 };
    }

    return { thrustN: 0, mdotKgPerS: 0, currentStage: 0 };
  }

  /**
   * Aerodynamic drag & dynamic pressure calculations for Faceted Pyramidal Airframe
   */
  computeAero(altitudeM, velocityVector, atmo) {
    const vMag = Math.sqrt(
      velocityVector.vx * velocityVector.vx +
      velocityVector.vy * velocityVector.vy +
      velocityVector.vz * velocityVector.vz
    );

    const mach = atmo.soundSpeed > 0 ? vMag / atmo.soundSpeed : 0;

    // Faceted pyramidal geometry minimizes supersonic wave drag via sharp oblique compression ramps
    let cd = this.baseCd;
    if (mach > 0.85 && mach < 1.25) {
      // Much lower transonic drag rise compared to cylinder/toroid
      cd += 0.12 * Math.sin(((mach - 0.85) / 0.4) * Math.PI);
    } else if (mach >= 1.25) {
      cd = 0.22 / Math.pow(mach, 0.45);
    }

    // Dynamic pressure q = 0.5 * rho * v^2
    const dynamicPressurePa = 0.5 * atmo.rho_air * vMag * vMag;
    const dragForceMag = dynamicPressurePa * cd * this.frontalAreaM2;

    const dragVector = {
      fx: vMag > 0.001 ? -dragForceMag * (velocityVector.vx / vMag) : 0,
      fy: vMag > 0.001 ? -dragForceMag * (velocityVector.vy / vMag) : 0,
      fz: vMag > 0.001 ? -dragForceMag * (velocityVector.vz / vMag) : 0,
    };

    return {
      dynamicPressurePa,
      dragForceMag,
      dragVector,
      mach,
      cd
    };
  }

  /**
   * Advance propellant consumption and attitude
   */
  step(dt, ambientPressurePa) {
    const { mdotKgPerS } = this.computeThrust(ambientPressurePa);

    if (this.status === ROCKET_STATUS.STAGE1_BURN) {
      this.stage1BurnElapsed += dt;
      const dProp = mdotKgPerS * dt;
      this.currentStage1Propellant = Math.max(0, this.currentStage1Propellant - dProp);
      if (this.currentStage1Propellant <= 0) {
        this.status = ROCKET_STATUS.STAGE2_BURN;
      }
    } else if (this.status === ROCKET_STATUS.STAGE2_BURN) {
      this.stage2BurnElapsed += dt;
      const dProp = mdotKgPerS * dt;
      this.currentStage2Propellant = Math.max(0, this.currentStage2Propellant - dProp);
      if (this.currentStage2Propellant <= 0) {
        this.status = ROCKET_STATUS.COAST;
      }
    }

    // High-altitude cold-gas reaction thruster pitch guidance (gravity turn into orbital insertion)
    if (this.status === ROCKET_STATUS.STAGE1_BURN || this.status === ROCKET_STATUS.STAGE2_BURN) {
      this.targetPitchDeg = Math.max(48.0, 90.0 - (this.stage1BurnElapsed * 0.85));
      const pitchErr = this.targetPitchDeg - this.attitudeRpyDeg.pitch;
      this.angularRateDps.pitchRate = pitchErr * 0.9;
      this.attitudeRpyDeg.pitch += this.angularRateDps.pitchRate * dt;
    }
  }
}
