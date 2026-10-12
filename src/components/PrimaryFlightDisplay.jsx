import React from 'react';
import { Gauge, Compass, ArrowUpRight, Layers, Flame } from 'lucide-react';

export function PrimaryFlightDisplay({ telemetry, kernel }) {
  if (!telemetry) return null;

  const baro = telemetry.barometric_sensor;
  const imu = telemetry.imu_sensor;
  const env = telemetry.environmental_sensors;
  const payload = telemetry.payload_state;
  const nav = telemetry.navigation_state;

  const trueAlt = baro.true_altitude_m || 0;
  const baroAlt = baro.derived_altitude_m || 0;
  const gpsAlt = nav.gps_altitude_m;

  const pitch = imu.attitude_rpy_deg[1] || 0;
  const roll = imu.attitude_rpy_deg[0] || 0;
  const yaw = (imu.attitude_rpy_deg[2] + 360) % 360;

  const climbRate = kernel.velocity.vy || 0;
  const accelG = ((kernel.acceleration.ay + 9.81) / 9.81).toFixed(2);

  // Dynamic pressure q = 0.5 * rho * v^2
  const vMag = Math.sqrt(
    kernel.velocity.vx * kernel.velocity.vx +
    kernel.velocity.vy * kernel.velocity.vy +
    kernel.velocity.vz * kernel.velocity.vz
  );
  const qPa = Math.round(0.5 * (baro.pressure_hpa * 100 / (287.05 * Math.max(150, env.ambient_temp_c + 273.15))) * vMag * vMag);

  // Artificial horizon visual pitch offset
  const pitchOffsetPx = Math.max(-50, Math.min(50, (pitch - 90) * 1.5));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs select-none">
      {/* 1. ARTIFICIAL HORIZON / ATTITUDE DIRECTOR */}
      <div className="col-span-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>Primary Flight Display (PFD)</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">RPY [°]</span>
        </div>

        {/* Gyro Horizon Widget */}
        <div className="relative w-full h-28 bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80 flex items-center justify-center">
          {/* Blue Sky / Brown Ground gradient rotating with roll and translating with pitch */}
          <div
            className="absolute inset-[-40px] transition-transform duration-75"
            style={{
              transform: `rotate(${-roll}deg) translateY(${pitchOffsetPx}px)`,
              background: 'linear-gradient(to bottom, #0284c7 0%, #0369a1 49%, #f59e0b 50%, #78350f 100%)',
              opacity: 0.85
            }}
          >
            {/* Horizon line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white shadow" />
          </div>

          {/* Fixed Aircraft Reticle */}
          <div className="absolute z-10 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-1 bg-amber-400 rounded-sm shadow" />
            <div className="w-2.5 h-2.5 border-2 border-amber-400 rounded-full mx-1 shadow" />
            <div className="w-12 h-1 bg-amber-400 rounded-sm shadow" />
          </div>

          {/* HUD digital overlays */}
          <div className="absolute top-1.5 left-2 text-[10px] font-mono text-white/90 bg-black/40 px-1.5 rounded">
            PITCH: {pitch.toFixed(1)}°
          </div>
          <div className="absolute top-1.5 right-2 text-[10px] font-mono text-white/90 bg-black/40 px-1.5 rounded">
            ROLL: {roll.toFixed(1)}°
          </div>
          <div className="absolute bottom-1.5 left-2 text-[10px] font-mono text-white/90 bg-black/40 px-1.5 rounded">
            YAW: {yaw.toFixed(0)}°
          </div>
          <div className="absolute bottom-1.5 right-2 text-[10px] font-mono text-amber-300 bg-black/40 px-1.5 rounded">
            {accelG} G
          </div>
        </div>
      </div>

      {/* 2. ALTITUDE & CLIMB INSTRUMENTS */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase text-sky-400 font-bold">
          <span>Altitude & Variometer</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </div>
        
        <div className="my-1">
          <div className="text-xl font-bold font-mono text-sky-300">
            {Math.round(trueAlt)} <span className="text-xs text-slate-400 font-normal">m</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {(trueAlt / 1000).toFixed(2)} km MSL
          </div>
        </div>

        <div className="space-y-1 text-[10px] font-mono border-t border-slate-800/80 pt-1.5 text-slate-400">
          <div className="flex justify-between">
            <span>Baro Alt:</span>
            <span className={baro.status === 'NOMINAL' ? 'text-slate-200' : 'text-rose-400 font-bold'}>
              {Math.round(baroAlt)} m
            </span>
          </div>
          <div className="flex justify-between">
            <span>GPS Alt:</span>
            <span className={gpsAlt !== null ? 'text-slate-200' : 'text-rose-400 font-bold'}>
              {gpsAlt !== null ? `${Math.round(gpsAlt)} m` : 'NO LOCK'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Climb Rate:</span>
            <span className="text-emerald-300 font-bold">
              {climbRate >= 0 ? `+${climbRate.toFixed(1)}` : climbRate.toFixed(1)} m/s
            </span>
          </div>
        </div>
      </div>

      {/* 3. AIRSPEED & DYNAMIC PRESSURE (MAX-Q MONITOR) */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase text-indigo-400 font-bold">
          <span>Airspeed & Dynamic Q</span>
          <Gauge className="w-3.5 h-3.5" />
        </div>

        <div className="my-1">
          <div className="text-xl font-bold font-mono text-indigo-300">
            {nav.true_airspeed_mps.toFixed(1)} <span className="text-xs text-slate-400 font-normal">m/s</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            TAS ({(nav.true_airspeed_mps * 3.6).toFixed(0)} km/h)
          </div>
        </div>

        <div className="space-y-1 text-[10px] font-mono border-t border-slate-800/80 pt-1.5 text-slate-400">
          <div className="flex justify-between">
            <span>Pitot Airspeed:</span>
            <span className={nav.pitot_status === 'NOMINAL' ? 'text-slate-200' : 'text-rose-400 font-bold'}>
              {nav.measured_airspeed_mps.toFixed(1)} m/s
            </span>
          </div>
          <div className="flex justify-between">
            <span>Dynamic Pres (q):</span>
            <span className="text-amber-300 font-bold">{qPa} Pa</span>
          </div>
          <div className="flex justify-between">
            <span>Mach No:</span>
            <span className="text-slate-200">M {(vMag / 320).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 4. ATMOSPHERIC STATE (ISA BAROMETRIC LAYER) */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase text-cyan-400 font-bold">
          <span>Atmosphere Layer</span>
          <Layers className="w-3.5 h-3.5" />
        </div>

        <div className="my-1">
          <div className="text-base font-bold font-mono text-cyan-300 truncate">
            {baro.pressure_hpa.toFixed(1)} <span className="text-xs text-slate-400 font-normal">hPa</span>
          </div>
          <div className="text-[10px] text-cyan-400/90 font-mono font-bold">
            {trueAlt < 11000 ? 'TROPOSPHERE' : trueAlt < 20000 ? 'TROPOPAUSE' : trueAlt < 36000 ? 'STRATOSPHERE' : trueAlt <= 40000 ? 'SBRL WINDOW (36-40km)' : 'STRATOPAUSE FLOAT'}
          </div>
        </div>

        <div className="space-y-1 text-[10px] font-mono border-t border-slate-800/80 pt-1.5 text-slate-400">
          <div className="flex justify-between">
            <span>Ambient Temp:</span>
            <span className="text-rose-300">{env.ambient_temp_c.toFixed(1)} °C</span>
          </div>
          <div className="flex justify-between">
            <span>Humidity:</span>
            <span className="text-blue-300">{env.relative_humidity_pct.toFixed(0)} %</span>
          </div>
          <div className="flex justify-between">
            <span>Wind Vect:</span>
            <span className="text-slate-200">[{env.effective_wind_vector_mps.slice(0, 2).join(', ')}]</span>
          </div>
        </div>
      </div>

      {/* 5. BALLOON & PROPULSION STATUS */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase text-emerald-400 font-bold">
          <span>Balloon & Mass</span>
          <Flame className="w-3.5 h-3.5" />
        </div>

        <div className="my-1">
          <div className="text-base font-bold font-mono text-emerald-300 truncate">
            {Math.round(payload.balloon_volume_m3).toLocaleString()} <span className="text-xs text-slate-400 font-normal">m³</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Envelope Expansion
          </div>
        </div>

        <div className="space-y-1 text-[10px] font-mono border-t border-slate-800/80 pt-1.5 text-slate-400">
          <div className="flex justify-between">
            <span>Rocket Status:</span>
            <span className="text-sky-300 font-bold">{payload.rocket_status}</span>
          </div>
          <div className="flex justify-between">
            <span>Thrust:</span>
            <span className="text-amber-300 font-bold">{Math.round(payload.thrust_n)} N</span>
          </div>
          <div className="flex justify-between">
            <span>Total Mass:</span>
            <span className="text-slate-200">{payload.total_mass_kg} kg</span>
          </div>
        </div>
      </div>
    </div>
  );
}
