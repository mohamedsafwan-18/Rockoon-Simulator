// Aeroin SpaceTech SBRL (Stratospheric Balloon Rocket Launcher)
// Pyramidal Direct-to-Orbit Launch System Architecture
// Two-stage rocket system achieving Low Earth Orbit (LEO) insertion from 36-40 km stratospheric launch.

import { CONSTANTS } from './isaAtmosphere.js';

export const ROCKET_STATUS = {
  SLUNG: 'SLUNG',
  ARMED: 'ARMED',
  RAIL_RELEASE: 'RAIL_RELEASE',
  SEPARATED: 'SEPARATED',
  STAGE1_BURN: 'STAGE1_BURN',
  STAGE1_SEPARATION: 'STAGE1_SEPARATION',
  STAGE2_BURN: 'STAGE2_BURN',
  LEO_ORBIT: 'LEO_ORBIT',
  COAST: 'COAST'
};

export class SbrlPyramidalRocket {
  constructor(config = {}) {
    // Stage 1 (Faceted Pyramidal Booster Core)
    this.stage1DryMassKg = config.stage1DryMassKg || 240.0;
    this.stage1PropellantKg = config.stage1PropellantKg || 1480.0;
    this.stage1ThrustVacN = config.stage1ThrustVacN || 122600.0;
    this.stage1IspVacS = config.stage1IspVacS || 355.0;
    this.stage1BurnDurationS = 42.0;

    // Stage 2 (Vacuum Insertion Upper Stage Core)
    this.stage2DryMassKg = config.stage2DryMassKg || 65.0;
    this.stage2PropellantKg = config.stage2PropellantKg || 520.0;
    this.stage2ThrustVacN = config.stage2ThrustVacN || 38750.0;
    this.stage2IspVacS = config.stage2IspVacS || 395.0;
    this.stage2BurnDurationS = 52.0;

    // Direct-to-Orbit SmallSat Payload Module
    this.payloadMassKg = config.payloadMassKg || 45.0;

    // Current Flight State
    this.status = ROCKET_STATUS.SLUNG;
    this.currentStage1Propellant = this.stage1PropellantKg;
    this.currentStage2Propellant = this.stage2PropellantKg;
    this.isStage1Jettisoned = false;
    this.stage1BurnElapsed = 0;
    this.stage2BurnElapsed = 0;
    this.orbitalVelocityMps = 0;
    this.apoapsisKm = 0;
    this.periapsisKm = 0;

    // Aerodynamic Geometry: Faceted Pyramidal Airframe
    this.baseWidthM = 1.35;
    this.heightM = 4.8;
    this.frontalAreaM2 = Math.pow(this.baseWidthM, 2);
    this.baseCd = 0.19;

    // Orientation: pitch (deg above horizontal, 90 = vertical up, 0 = horizontal LEO), roll, yaw
    this.attitudeRpyDeg = { roll: 0.0, pitch: 90.0, yaw: 0.0 };
    this.angularRateDps = { rollRate: 0.0, pitchRate: 0.0, yawRate: 0.0 };
    this.targetPitchDeg = 90.0;

    // Forward-rail release separation speed
    this.railSlideProgressM = 0.0;
  }

  /**
   * Current total mass of the SBRL launch vehicle (accounts for stage separation)
   */
  getMassKg() {
    let m = this.payloadMassKg;

    // Stage 2 mass
    m += this.stage2DryMassKg + this.currentStage2Propellant;

    // Stage 1 mass (dropped upon interstage separation)
    if (!this.isStage1Jettisoned) {
      m += this.stage1DryMassKg + this.currentStage1Propellant;
    }

    return m;
  }

  /**
   * Compute thrust and mass flow rate based on current stage
   */
  computeThrust(ambientPressurePa) {
    if (this.status === ROCKET_STATUS.STAGE1_BURN) {
      if (this.currentStage1Propellant <= 0) {
        return { thrustN: 0, mdotKgPerS: 0, currentStage: 1 };
      }
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

    let cd = this.baseCd;
    if (mach > 0.85 && mach < 1.25) {
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
   * Advance propellant consumption, staging sequence, and orbital guidance
   */
  step(dt, ambientPressurePa, altitudeM, velocityVector = { vx: 0, vy: 0, vz: 0 }) {
    const { mdotKgPerS } = this.computeThrust(ambientPressurePa);

    // Horizontal speed
    const horizSpeed = Math.sqrt(velocityVector.vx * velocityVector.vx + velocityVector.vz * velocityVector.vz);
    this.orbitalVelocityMps = Math.sqrt(velocityVector.vx * velocityVector.vx + velocityVector.vy * velocityVector.vy + velocityVector.vz * velocityVector.vz);

    // ================= 1. STAGE 1 BURN =================
    if (this.status === ROCKET_STATUS.STAGE1_BURN) {
      this.stage1BurnElapsed += dt;
      const dProp = mdotKgPerS * dt;
      this.currentStage1Propellant = Math.max(0, this.currentStage1Propellant - dProp);

      // Stage 1 Gravity Turn: starts vertical (90 deg), turns down to 28 deg at burnout
      const progress = Math.min(1.0, this.stage1BurnElapsed / this.stage1BurnDurationS);
      this.targetPitchDeg = 90.0 - progress * 62.0;

      // Stage 1 Burnout -> Transition to Interstage Separation & Stage 2
      if (this.currentStage1Propellant <= 0 || this.stage1BurnElapsed >= this.stage1BurnDurationS) {
        this.status = ROCKET_STATUS.STAGE2_BURN;
        this.isStage1Jettisoned = true; // Drop Stage 1 booster core
        this.currentStage1Propellant = 0;
      }
    }

    // ================= 2. STAGE 1 SEPARATION (Brief Interstage Coast) =================
    else if (this.status === ROCKET_STATUS.STAGE1_SEPARATION) {
      this.isStage1Jettisoned = true;
      this.status = ROCKET_STATUS.STAGE2_BURN;
    }

    // ================= 3. STAGE 2 VACUUM INSERTION BURN =================
    else if (this.status === ROCKET_STATUS.STAGE2_BURN) {
      this.stage2BurnElapsed += dt;
      const dProp = mdotKgPerS * dt;
      this.currentStage2Propellant = Math.max(0, this.currentStage2Propellant - dProp);

      // Stage 2 Orbital Insertion Guidance: pitch steers from 28 deg down to 0 deg (local horizontal)
      const progress = Math.min(1.0, this.stage2BurnElapsed / this.stage2BurnDurationS);
      this.targetPitchDeg = Math.max(0.0, 28.0 - progress * 34.0);

      // Check for Low Earth Orbit (LEO) insertion condition (velocity >= 7750 m/s & altitude >= 160 km)
      const isOrbitalSpeed = horizSpeed >= 7750 || this.orbitalVelocityMps >= 7780;
      const isAboveAtmo = altitudeM >= 160000;

      if ((this.currentStage2Propellant <= 0 || isOrbitalSpeed) && isAboveAtmo) {
        this.status = ROCKET_STATUS.LEO_ORBIT;
        this.currentStage2Propellant = 0;
        this.targetPitchDeg = 0.0;
        this.attitudeRpyDeg.pitch = 0.0;
        this.apoapsisKm = Math.round(altitudeM / 1000 + 5);
        this.periapsisKm = Math.round(altitudeM / 1000 - 2);
      } else if (this.currentStage2Propellant <= 0) {
        this.status = ROCKET_STATUS.COAST;
      }
    }

    // ================= 4. LEO ORBIT COASTING =================
    else if (this.status === ROCKET_STATUS.LEO_ORBIT) {
      this.targetPitchDeg = 0.0; // Horizontal prograde orientation in orbit
    }

    // Attitude control actuator smoothing (clamped for arbitrary time-step stability)
    const pitchErr = this.targetPitchDeg - this.attitudeRpyDeg.pitch;
    const alpha = Math.min(1.0, 2.5 * dt);
    this.angularRateDps.pitchRate = (pitchErr * alpha) / Math.max(dt, 0.001);
    this.attitudeRpyDeg.pitch += pitchErr * alpha;
  }
}
