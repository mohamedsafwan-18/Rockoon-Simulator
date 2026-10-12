// Aeroin SpaceTech SBRL (Stratospheric Balloon Rocket Launcher)
// Pyramidal Direct-to-Orbit Launch System Architecture
// Two-stage rocket system achieving Low Earth Orbit (LEO) insertion from 36-40 km stratospheric launch.
// Includes:
// - Multi-phase balloon-to-rocket separation & RCS ullage stabilization sequence
// - Stage 2 propulsion anomaly / failed LEO insertion suborbital decay mode
// - Keplerian vis-viva orbital mechanics, specific energy, angular momentum, Tsiolkovsky Delta-V, and aerothermal flux

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
  ORBIT_INSERTION_FAILURE: 'ORBIT_INSERTION_FAILURE',
  COAST: 'COAST',
};

const MU_EARTH = 3.986004418e14; // Standard gravitational parameter G*M_earth (m^3/s^2)
const R_EARTH = 6371000.0;       // Mean Earth radius (m)

export class SbrlPyramidalRocket {
  constructor(config = {}) {
    // Stage 1 (Faceted Pyramidal Booster Core)
    this.stage1DryMassKg = config.stage1DryMassKg || 240.0;
    this.stage1PropellantKg = config.stage1PropellantKg || 1480.0;
    this.stage1ThrustVacN = config.stage1ThrustVacN || 127200.0; // Sized for 40.5s main burn after 1.5s drop-clear/ullage
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
    this.stagingSubPhase = 'ATTACHED'; // 'ATTACHED' | 'PYRO_DROP_CLEAR' | 'RCS_ULLAGE_SETTLING' | 'MAIN_ENGINE_IGNITION' | 'STAGE2_VACUUM_BURN'
    this.separationClearanceM = 0.0;   // Distance dropped below balloon gondola during separation
    this.isRcsFiring = false;
    this.stage2FailureMode = false;    // Preset flag: simulates Stage 2 underburn / failed LEO insertion

    this.currentStage1Propellant = this.stage1PropellantKg;
    this.currentStage2Propellant = this.stage2PropellantKg;
    this.isStage1Jettisoned = false;
    this.stage1BurnElapsed = 0;
    this.stage2BurnElapsed = 0;
    this.thrustN = 0.0;
    this.orbitalVelocityMps = 0;
    this.apoapsisKm = 0;
    this.periapsisKm = 0;

    // Advanced Physics & Keplerian Orbital State
    this.specificOrbitalEnergyMJkg = -62.56; // v^2/2 - mu/r (MJ/kg)
    this.specificAngularMomentumM2s = 0.0;   // r * v_horiz (m^2/s)
    this.eccentricity = 1.0;
    this.semiMajorAxisKm = 0.0;
    this.remainingDeltaVMps = this.computeRemainingDeltaV();
    this.aerodynamicHeatFluxWm2 = 0.0;
    this.maxQPa = 0.0;

    // Aerodynamic Geometry: Faceted Pyramidal Airframe
    this.baseWidthM = 1.35;
    this.heightM = 4.8;
    this.frontalAreaM2 = Math.pow(this.baseWidthM, 2);
    this.baseCd = 0.19;

    // Orientation: pitch (deg above horizontal, 90 = vertical up, 0 = horizontal LEO), roll, yaw
    this.attitudeRpyDeg = { roll: 0.0, pitch: 90.0, yaw: 0.0 };
    this.angularRateDps = { rollRate: 0.0, pitchRate: 0.0, yawRate: 0.0 };
    this.targetPitchDeg = 90.0;

    this.railSlideProgressM = 0.0;
  }

  /**
   * Current total mass of the SBRL launch vehicle (accounts for stage separation)
   */
  getMassKg() {
    let m = this.payloadMassKg + this.stage2DryMassKg + this.currentStage2Propellant;
    if (!this.isStage1Jettisoned) {
      m += this.stage1DryMassKg + this.currentStage1Propellant;
    }
    return m;
  }

  /**
   * Analytical Tsiolkovsky Rocket Equation remaining Delta-V budget (m/s)
   */
  computeRemainingDeltaV() {
    let dv1 = 0;
    const mStg2Wet = this.payloadMassKg + this.stage2DryMassKg + this.currentStage2Propellant;
    const mStg2Dry = this.payloadMassKg + this.stage2DryMassKg;

    if (!this.isStage1Jettisoned && this.currentStage1Propellant > 0) {
      const mTotWet = mStg2Wet + this.stage1DryMassKg + this.currentStage1Propellant;
      const mTotDry = mStg2Wet + this.stage1DryMassKg;
      dv1 = this.stage1IspVacS * CONSTANTS.g0 * Math.log(mTotWet / mTotDry);
    }

    let dv2 = 0;
    if (this.currentStage2Propellant > 0) {
      const effIsp2 = this.stage2FailureMode ? this.stage2IspVacS * 0.48 : this.stage2IspVacS;
      dv2 = effIsp2 * CONSTANTS.g0 * Math.log(mStg2Wet / mStg2Dry);
    }

    return dv1 + dv2;
  }

  /**
   * Compute thrust and mass flow rate based on current stage and separation sub-phase
   */
  computeThrust(ambientPressurePa) {
    if (this.status === ROCKET_STATUS.STAGE1_BURN) {
      if (this.currentStage1Propellant <= 0) {
        this.thrustN = 0;
        return { thrustN: 0, mdotKgPerS: 0, currentStage: 1 };
      }

      // Realistic Balloon-to-Rocket Transition:
      // 0.0s - 0.8s: Pyrotechnic drop-clear (cold gas push + gravity clearance)
      // 0.8s - 1.5s: Cold-gas RCS ullage settling burn (4.2 kN settling thrust)
      // >= 1.5s: Full Stage 1 4-nozzle yellow plasma main engine ignition
      if (this.stage1BurnElapsed < 0.8) {
        this.stagingSubPhase = 'PYRO_DROP_CLEAR';
        this.isRcsFiring = true;
        this.thrustN = 850.0;
        return { thrustN: 850.0, mdotKgPerS: 0.0, currentStage: 1 };
      }
      if (this.stage1BurnElapsed < 1.5) {
        this.stagingSubPhase = 'RCS_ULLAGE_SETTLING';
        this.isRcsFiring = true;
        this.thrustN = 5200.0;
        return { thrustN: 5200.0, mdotKgPerS: 0.0, currentStage: 1 };
      }

      this.stagingSubPhase = 'MAIN_ENGINE_IGNITION';
      this.isRcsFiring = false;
      const pRatio = Math.max(0, 1 - (ambientPressurePa / CONSTANTS.P0_std) * 0.05);
      const thrustN = this.stage1ThrustVacN * pRatio;
      const mdotKgPerS = this.stage1ThrustVacN / (this.stage1IspVacS * CONSTANTS.g0);
      this.thrustN = thrustN;
      return { thrustN, mdotKgPerS, currentStage: 1 };
    }

    if (this.status === ROCKET_STATUS.STAGE2_BURN) {
      if (this.currentStage2Propellant <= 0) {
        this.thrustN = 0;
        return { thrustN: 0, mdotKgPerS: 0, currentStage: 2 };
      }
      this.stagingSubPhase = this.stage2FailureMode ? 'STAGE2_TURBOPUMP_ANOMALY' : 'STAGE2_VACUUM_BURN';
      this.isRcsFiring = false;

      // In Stage 2 Failure Mode, chamber pressure cavitates to 36% nominal thrust
      const thrustMultiplier = this.stage2FailureMode ? 0.36 : 1.0;
      const thrustN = this.stage2ThrustVacN * thrustMultiplier;
      const mdotKgPerS = this.stage2ThrustVacN / (this.stage2IspVacS * CONSTANTS.g0);
      this.thrustN = thrustN;
      return { thrustN, mdotKgPerS, currentStage: 2 };
    }

    this.isRcsFiring = false;
    this.thrustN = 0;
    return { thrustN: 0, mdotKgPerS: 0, currentStage: 0 };
  }

  /**
   * Aerodynamic drag, dynamic pressure (q), Max-Q, and aerothermal heat flux
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
    if (dynamicPressurePa > this.maxQPa) {
      this.maxQPa = dynamicPressurePa;
    }

    // Free-molecular / continuum aerodynamic heat flux: q_dot = 0.5 * rho * v^3 (W/m^2)
    this.aerodynamicHeatFluxWm2 = 0.5 * atmo.rho_air * Math.pow(vMag, 3);

    const dragForceMag = dynamicPressurePa * cd * this.frontalAreaM2;

    const dragVector = {
      fx: vMag > 0.001 ? -dragForceMag * (velocityVector.vx / vMag) : 0,
      fy: vMag > 0.001 ? -dragForceMag * (velocityVector.vy / vMag) : 0,
      fz: vMag > 0.001 ? -dragForceMag * (velocityVector.vz / vMag) : 0,
    };

    return {
      dynamicPressurePa,
      maxQPa: this.maxQPa,
      aerodynamicHeatFluxWm2: this.aerodynamicHeatFluxWm2,
      dragForceMag,
      dragVector,
      mach,
      cd,
    };
  }

  /**
   * Compute Keplerian Orbital Elements from position & velocity state vectors
   */
  updateOrbitalMechanics(altitudeM, velocityVector) {
    const r = R_EARTH + Math.max(0, altitudeM);
    const vSq =
      velocityVector.vx * velocityVector.vx +
      velocityVector.vy * velocityVector.vy +
      velocityVector.vz * velocityVector.vz;
    const horizSpeed = Math.sqrt(velocityVector.vx * velocityVector.vx + velocityVector.vz * velocityVector.vz);

    this.orbitalVelocityMps = Math.sqrt(vSq);

    // Specific orbital energy: epsilon = v^2 / 2 - mu / r (J/kg -> MJ/kg)
    const epsJkg = 0.5 * vSq - MU_EARTH / r;
    this.specificOrbitalEnergyMJkg = epsJkg / 1e6;

    // Specific angular momentum: h = r * v_horiz (m^2/s)
    this.specificAngularMomentumM2s = r * horizSpeed;

    // Semi-major axis: a = -mu / (2 * eps)
    if (Math.abs(epsJkg) > 1.0) {
      const aM = -MU_EARTH / (2 * epsJkg);
      this.semiMajorAxisKm = aM / 1000.0;

      // Eccentricity: e = sqrt(1 + 2 * eps * h^2 / mu^2)
      const eTerm = 1.0 + (2.0 * epsJkg * Math.pow(this.specificAngularMomentumM2s, 2)) / Math.pow(MU_EARTH, 2);
      this.eccentricity = Math.sqrt(Math.max(0.0, eTerm));

      if (aM > 0) {
        const raM = aM * (1.0 + this.eccentricity) - R_EARTH;
        const rpM = aM * (1.0 - this.eccentricity) - R_EARTH;
        this.apoapsisKm = Math.max(0, Math.round(raM / 1000));
        this.periapsisKm = Math.round(rpM / 1000);
      }
    }

    this.remainingDeltaVMps = this.computeRemainingDeltaV();
  }

  /**
   * Advance propellant consumption, staging sequence, and orbital guidance
   */
  step(dt, ambientPressurePa, altitudeM, velocityVector = { vx: 0, vy: 0, vz: 0 }) {
    const { mdotKgPerS } = this.computeThrust(ambientPressurePa);
    const horizSpeed = Math.sqrt(velocityVector.vx * velocityVector.vx + velocityVector.vz * velocityVector.vz);

    this.updateOrbitalMechanics(altitudeM, velocityVector);

    // ================= 1. STAGE 1 BURN (With Drop-Clear & Ullage Transition) =================
    if (this.status === ROCKET_STATUS.STAGE1_BURN) {
      this.stage1BurnElapsed += dt;

      if (this.stage1BurnElapsed < 1.5) {
        // Separation clearance distance increases as rocket drops clear of balloon wake
        this.separationClearanceM += 12.0 * dt;
        this.targetPitchDeg = 89.0; // RCS aligns rocket near-vertical during drop-clear
        this.attitudeRpyDeg.roll *= Math.max(0, 1 - 4.0 * dt);
      } else {
        this.separationClearanceM += 35.0 * dt;
        const dProp = mdotKgPerS * dt;
        this.currentStage1Propellant = Math.max(0, this.currentStage1Propellant - dProp);

        // Stage 1 Gravity Turn: starts vertical (90 deg), turns down to 28 deg at burnout
        const burnProgress = Math.min(1.0, (this.stage1BurnElapsed - 1.5) / (this.stage1BurnDurationS - 1.5));
        this.targetPitchDeg = 90.0 - burnProgress * 62.0;
      }

      // Stage 1 Burnout -> Transition to Interstage Separation & Stage 2
      if (this.currentStage1Propellant <= 0 || this.stage1BurnElapsed >= this.stage1BurnDurationS) {
        this.status = ROCKET_STATUS.STAGE2_BURN;
        this.isStage1Jettisoned = true;
        this.currentStage1Propellant = 0;
      }
    }

    // ================= 2. STAGE 1 SEPARATION =================
    else if (this.status === ROCKET_STATUS.STAGE1_SEPARATION) {
      this.isStage1Jettisoned = true;
      this.status = ROCKET_STATUS.STAGE2_BURN;
    }

    // ================= 3. STAGE 2 VACUUM INSERTION BURN =================
    else if (this.status === ROCKET_STATUS.STAGE2_BURN) {
      this.stage2BurnElapsed += dt;
      const dProp = mdotKgPerS * dt;
      this.currentStage2Propellant = Math.max(0, this.currentStage2Propellant - dProp);

      if (this.stage2FailureMode) {
        // ANOMALY PRESET: Stage 2 suffers thrust loss & TVC pitch droop, failing to achieve LEO
        const progress = Math.min(1.0, this.stage2BurnElapsed / 28.0);
        this.targetPitchDeg = 18.0 - progress * 38.0; // Droops below horizon (-20 deg)

        if (this.stage2BurnElapsed >= 28.0 || this.currentStage2Propellant <= 0) {
          this.status = ROCKET_STATUS.ORBIT_INSERTION_FAILURE;
          this.stagingSubPhase = 'ORBIT_INSERTION_FAILURE';
        }
      } else {
        // NOMINAL Stage 2 Orbital Insertion Guidance: pitch steers from 28 deg down to 0 deg
        const progress = Math.min(1.0, this.stage2BurnElapsed / this.stage2BurnDurationS);
        this.targetPitchDeg = Math.max(0.0, 28.0 - progress * 34.0);

        const isOrbitalSpeed = horizSpeed >= 7750 || this.orbitalVelocityMps >= 7780;
        const isAboveAtmo = altitudeM >= 160000;

        if ((this.currentStage2Propellant <= 0 || isOrbitalSpeed) && isAboveAtmo) {
          this.status = ROCKET_STATUS.LEO_ORBIT;
          this.stagingSubPhase = 'LEO_CIRCULARIZED';
          this.currentStage2Propellant = 0;
          this.targetPitchDeg = 0.0;
          this.attitudeRpyDeg.pitch = 0.0;
          this.eccentricity = 0.0008;
          this.apoapsisKm = Math.round(altitudeM / 1000 + 2);
          this.periapsisKm = Math.round(altitudeM / 1000 - 1);
        } else if (this.currentStage2Propellant <= 0) {
          this.status = ROCKET_STATUS.ORBIT_INSERTION_FAILURE;
        }
      }
    }

    // ================= 4. LEO ORBIT COASTING =================
    else if (this.status === ROCKET_STATUS.LEO_ORBIT) {
      this.targetPitchDeg = 0.0;
    }

    // ================= 5. FAILED ORBIT INSERTION (SUBORBITAL BALLISTIC DECAY) =================
    else if (this.status === ROCKET_STATUS.ORBIT_INSERTION_FAILURE) {
      this.targetPitchDeg = Math.max(-45.0, (Math.atan2(velocityVector.vy, Math.max(1, horizSpeed)) * 180) / Math.PI);
    }

    // Attitude control actuator smoothing
    const pitchErr = this.targetPitchDeg - this.attitudeRpyDeg.pitch;
    const alpha = Math.min(1.0, 2.5 * dt);
    this.angularRateDps.pitchRate = (pitchErr * alpha) / Math.max(dt, 0.001);
    this.attitudeRpyDeg.pitch += pitchErr * alpha;
  }
}
