// International Standard Atmosphere (ISA) Model with Stratospheric Inversion & Humidity Effects
// Implements barometric equations across Troposphere, Tropopause, and Stratosphere

export const CONSTANTS = {
  g0: 9.80665,         // Standard gravity (m/s^2)
  R_gas: 8.3144598,    // Universal gas constant (J/(mol*K))
  M_air: 0.0289644,    // Molar mass of dry air (kg/mol)
  M_he: 0.0040026,     // Molar mass of helium (kg/mol)
  M_vapor: 0.0180153,  // Molar mass of water vapor (kg/mol)
  P0_std: 101325.0,    // Sea level standard pressure (Pa)
  T0_std: 288.15,      // Sea level standard temperature (K, 15°C)
  gamma: 1.40,         // Heat capacity ratio for air
};

/**
 * Compute atmospheric parameters at a given geometric altitude.
 * @param {number} altitudeM - Geometric altitude in meters
 * @param {Object} envParams - Environmental modifiers
 * @returns {Object} Atmospheric properties (T_k, T_c, P_pa, P_hpa, rho_air, rho_he, soundSpeed, humidityPct)
 */
export function calculateAtmosphere(altitudeM, envParams = {}) {
  const {
    tempDeltaC = 0,            // Ambient temperature offset (-30 to +30 °C)
    pressureScale = 1.0,       // Atmospheric pressure scale factor (0.8x to 1.2x)
    surfaceHumidityPct = 60,   // Surface relative humidity (0 to 100%)
    airDensityScale = 1.0,     // Air density scale factor (0.7x to 1.3x)
    lapseRateCPerKm = -6.5,    // Tropospheric temperature lapse rate (-9.8 to -3.5 °C/km)
    solarRadiationWm2 = 1000,  // Solar radiation intensity (0 to 1400 W/m^2)
  } = envParams;

  const h = Math.max(0, altitudeM);
  let T_k = CONSTANTS.T0_std;
  let P_pa = CONSTANTS.P0_std;

  // ISA Layer boundaries
  const h_tropopause = 11000;  // 11 km
  const h_strat1 = 20000;      // 20 km
  const h_strat2 = 32000;      // 32 km
  const h_stratopause = 47000; // 47 km

  // Lapse rates (K/m)
  const L_tropo = (lapseRateCPerKm !== undefined ? lapseRateCPerKm : -6.5) / 1000.0; // Default -0.0065 K/m
  const L_strat1 = 0.0010;      // +1.0 K/km warming in lower stratosphere
  const L_strat2 = 0.0028;      // +2.8 K/km warming in mid stratosphere

  const T0_base = CONSTANTS.T0_std + tempDeltaC;
  const P0_base = CONSTANTS.P0_std * pressureScale;

  // Layer 0: Troposphere (0 - 11 km)
  const T_11 = T0_base + L_tropo * h_tropopause;
  const P_11 = P0_base * Math.pow(T_11 / T0_base, -CONSTANTS.g0 * CONSTANTS.M_air / (CONSTANTS.R_gas * L_tropo));

  // Layer 1: Tropopause isothermal (11 - 20 km)
  const T_20 = T_11;
  const P_20 = P_11 * Math.exp(-CONSTANTS.g0 * CONSTANTS.M_air * (h_strat1 - h_tropopause) / (CONSTANTS.R_gas * T_11));

  // Layer 2: Lower Stratosphere (20 - 32 km)
  const T_32 = T_20 + L_strat1 * (h_strat2 - h_strat1);
  const P_32 = P_20 * Math.pow(T_32 / T_20, -CONSTANTS.g0 * CONSTANTS.M_air / (CONSTANTS.R_gas * L_strat1));

  if (h <= h_tropopause) {
    // Troposphere
    T_k = T0_base + L_tropo * h;
    P_pa = P0_base * Math.pow(T_k / T0_base, -CONSTANTS.g0 * CONSTANTS.M_air / (CONSTANTS.R_gas * L_tropo));
  } else if (h <= h_strat1) {
    // Tropopause
    T_k = T_11;
    P_pa = P_11 * Math.exp(-CONSTANTS.g0 * CONSTANTS.M_air * (h - h_tropopause) / (CONSTANTS.R_gas * T_11));
  } else if (h <= h_strat2) {
    // Lower Stratosphere (Inversion layer)
    T_k = T_20 + L_strat1 * (h - h_strat1);
    P_pa = P_20 * Math.pow(T_k / T_20, -CONSTANTS.g0 * CONSTANTS.M_air / (CONSTANTS.R_gas * L_strat1));
  } else {
    // Mid/Upper Stratosphere
    const h_eff = Math.min(h, h_stratopause);
    T_k = T_32 + L_strat2 * (h_eff - h_strat2);
    P_pa = P_32 * Math.pow(T_k / T_32, -CONSTANTS.g0 * CONSTANTS.M_air / (CONSTANTS.R_gas * L_strat2));
  }

  // Ensure positive values
  T_k = Math.max(160, T_k);
  P_pa = Math.max(1.0, P_pa);

  // Relative humidity gradient (drops exponentially with altitude, near-zero above tropopause)
  let humidityPct = surfaceHumidityPct * Math.exp(-h / 3000);
  if (h > 12000) humidityPct = Math.max(0.1, humidityPct * 0.1);
  humidityPct = Math.min(100, Math.max(0, humidityPct));

  // Saturation vapor pressure (Tetens formula, in hPa -> Pa)
  const T_c = T_k - 273.15;
  const P_sat_hpa = 6.1078 * Math.pow(10, (7.5 * T_c) / (T_c + 237.3));
  const P_sat_pa = P_sat_hpa * 100;
  const P_vapor = (humidityPct / 100) * P_sat_pa;
  const P_dry = Math.max(0, P_pa - P_vapor);

  // Density using ideal gas law with moist air correction and sandbox airDensityScale
  const rho_dry = (P_dry * CONSTANTS.M_air) / (CONSTANTS.R_gas * T_k);
  const rho_vapor = (P_vapor * CONSTANTS.M_vapor) / (CONSTANTS.R_gas * T_k);
  const rho_air = (rho_dry + rho_vapor) * (airDensityScale !== undefined ? airDensityScale : 1.0);

  // Solar radiative superheating of helium gas inside envelope (proportional to solar radiation intensity)
  const solarFlux = solarRadiationWm2 !== undefined ? solarRadiationWm2 : 1000;
  const solarDeltaTK = ((solarFlux - 1000) / 1000) * 16.0 * (1 + 0.4 * Math.min(1, h / 38000));
  const T_he_k = Math.max(160, T_k + solarDeltaTK);

  // Helium density at internal gas temperature and ambient pressure
  const rho_he = (P_pa * CONSTANTS.M_he) / (CONSTANTS.R_gas * T_he_k);

  // Speed of sound
  const soundSpeed = Math.sqrt((CONSTANTS.gamma * CONSTANTS.R_gas * T_k) / CONSTANTS.M_air);

  return {
    altitudeM: h,
    T_k,
    T_c,
    T_he_k,
    P_pa,
    P_hpa: P_pa / 100,
    rho_air,
    rho_he,
    soundSpeed,
    humidityPct,
    solarRadiationWm2: solarFlux,
    lapseRateCPerKm: lapseRateCPerKm !== undefined ? lapseRateCPerKm : -6.5,
    layerName: getLayerName(h)
  };
}

/**
 * Barometric altitude inversion (derived altitude from measured pressure)
 * Accurately handles Troposphere, Tropopause, Lower Stratosphere, and Upper Stratosphere (up to 47 km)
 */
export function pressureToAltitude(pressureHpa, tempDeltaC = 0) {
  const P_pa = Math.max(0.5, pressureHpa * 100);
  const T0 = CONSTANTS.T0_std + tempDeltaC;
  const P0 = CONSTANTS.P0_std;
  const L_tropo = -0.0065;
  const L_strat1 = 0.0010;
  const L_strat2 = 0.0028;

  // Layer 0: Troposphere (0 - 11 km)
  const T_11 = T0 + L_tropo * 11000;
  const exp_tropo = -CONSTANTS.g0 * CONSTANTS.M_air / (CONSTANTS.R_gas * L_tropo);
  const P_11 = P0 * Math.pow(T_11 / T0, exp_tropo);

  if (P_pa >= P_11) {
    return (T0 / (-L_tropo)) * (1 - Math.pow(P_pa / P0, 1 / exp_tropo));
  }

  // Layer 1: Tropopause isothermal (11 - 20 km)
  const T_20 = T_11;
  const P_20 = P_11 * Math.exp(-CONSTANTS.g0 * CONSTANTS.M_air * (9000) / (CONSTANTS.R_gas * T_11));

  if (P_pa >= P_20) {
    return 11000 - (CONSTANTS.R_gas * T_11 / (CONSTANTS.g0 * CONSTANTS.M_air)) * Math.log(P_pa / P_11);
  }

  // Layer 2: Lower Stratosphere (20 - 32 km)
  const T_32 = T_20 + L_strat1 * (12000);
  const exp_strat1 = -CONSTANTS.g0 * CONSTANTS.M_air / (CONSTANTS.R_gas * L_strat1);
  const P_32 = P_20 * Math.pow(T_32 / T_20, exp_strat1);

  if (P_pa >= P_32) {
    return 20000 + (T_20 / L_strat1) * (Math.pow(P_pa / P_20, 1 / exp_strat1) - 1);
  }

  // Layer 3: Upper Stratosphere (32 - 47 km)
  const exp_strat2 = -CONSTANTS.g0 * CONSTANTS.M_air / (CONSTANTS.R_gas * L_strat2);
  return 32000 + (T_32 / L_strat2) * (Math.pow(P_pa / P_32, 1 / exp_strat2) - 1);
}

export function getLayerName(altitudeM) {
  if (altitudeM < 11000) return 'TROPOSPHERE';
  if (altitudeM < 20000) return 'TROPOPAUSE';
  if (altitudeM < 32000) return 'LOWER_STRATOSPHERE';
  if (altitudeM < 40000) return 'STRATOSPHERE_SBRL_WINDOW (36-40 km)';
  if (altitudeM < 47000) return 'UPPER_STRATOSPHERE';
  return 'STRATOPAUSE_BOUNDARY';
}
