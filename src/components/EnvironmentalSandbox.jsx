import React, { useState } from 'react';
import { Sliders, Wind, Thermometer, Droplets, Gauge, AlertTriangle, ChevronDown, ChevronUp, RotateCcw, Zap, ShieldAlert, ShieldCheck, Flame, Skull } from 'lucide-react';

export function EnvironmentalSandbox({ kernel, onUpdate }) {
  const [isOpen, setIsOpen] = useState(true);

  const env = kernel.env;
  const faults = kernel.faults;

  const handleEnvChange = (key, val) => {
    kernel.setEnvParam(key, val);
    onUpdate();
  };

  const handleFaultToggle = (key) => {
    kernel.toggleFault(key);
    onUpdate();
  };

  const resetDefaults = () => {
    kernel.resetEnvAndFaults();
    onUpdate();
  };

  const handleManualBurst = () => {
    kernel.triggerBalloonBurst('MANUAL BURST TEST: Envelope punctured via Sandbox operator command.');
    onUpdate();
  };

  const handleRepairEnvelope = () => {
    kernel.isBalloonBurst = false;
    kernel.balloonBurstReason = null;
    kernel.balloon.isBurst = false;
    kernel.balloon.isCutDown = false;
    kernel.isTetherAttached = true;
    onUpdate();
  };

  const activeFaultCount = Object.values(faults).filter(Boolean).length;
  const driftKm = (kernel.currentDriftM / 1000).toFixed(1);
  const safezoneRadiusKm = (kernel.safezoneRadiusM / 1000).toFixed(0);
  const isInside = kernel.isInsideSafezone;
  const isBurst = kernel.isBalloonBurst;

  // Calculate current envelope stress percentage
  const atmo = kernel.generateSensorReadings()?.environmental_sensors;
  const theoreticalVol = kernel.balloon?.getState(kernel.position.y, kernel.velocity, env)?.theoreticalVolumeM3 || 4200;
  const envelopeStressPct = Math.min(100, Math.round((theoreticalVol / kernel.balloon.burstVolumeLimitM3) * 100));

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden shadow-2xl transition-all">
      {/* Header Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 border-b border-slate-800 select-none"
      >
        <div className="flex items-center space-x-2.5">
          <Sliders className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Mission Control & Environmental Sandbox
          </h2>
          {activeFaultCount > 0 && (
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-[10px] font-mono text-rose-300 font-bold animate-pulse">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>{activeFaultCount} FAULTS INJECTED</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <button
            onClick={(e) => { e.stopPropagation(); resetDefaults(); }}
            className="p-1 hover:text-sky-300 rounded hover:bg-slate-800 text-xs transition-colors"
            title="Reset to Standard Atmosphere"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-4 space-y-4 text-xs text-slate-300 max-h-[calc(100vh-240px)] overflow-y-auto custom-scrollbar">
          
          {/* RANGE SAFETY & BALLOON ENVELOPE REAL-TIME GAUGES */}
          <div className="space-y-2.5">
            {/* SAFEZONE STATUS CARD */}
            <div className={`p-2.5 rounded-xl border flex flex-col space-y-1.5 transition-all ${
              isInside
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/60 text-rose-300 animate-pulse'
            }`}>
              <div className="flex items-center justify-between font-mono text-[11px] font-bold">
                <span className="flex items-center gap-1.5">
                  {isInside ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-rose-400" />}
                  <span>{isInside ? 'AIRSPACE STATUS: APPROVED SAFEZONE' : 'ILLEGAL LAUNCH: AIRSPACE CORRIDOR VIOLATED!'}</span>
                </span>
                <span>{driftKm} / {safezoneRadiusKm} km</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full transition-all ${isInside ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(100, (kernel.currentDriftM / kernel.safezoneRadiusM) * 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-sans">
                {isInside 
                  ? `Vehicle is within ${safezoneRadiusKm} km approved maritime range safety perimeter.`
                  : `⚠️ Airspace safety corridor exceeded! Rocket launch outside safezone is illegal and interlocked.`
                }
              </div>
            </div>

            {/* BALLOON STRUCTURAL INTEGRITY & BURST ALERT */}
            {isBurst ? (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/80 text-rose-200 flex flex-col space-y-2 shadow-lg">
                <div className="flex items-center justify-between font-mono font-bold text-xs text-rose-300">
                  <span className="flex items-center gap-1.5">
                    <Skull className="w-4 h-4 text-rose-400 animate-bounce" />
                    <span>ENVELOPE RUPTURED / BURST!</span>
                  </span>
                  <span className="text-[10px] bg-rose-900/60 px-2 py-0.5 rounded text-rose-300">ROCKET IN FREE FALL</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300 font-sans">
                  {kernel.balloonBurstReason || 'Envelope structural stress limit exceeded. Buoyancy lost; vehicle falling under gravity.'}
                </p>
                <button
                  onClick={handleRepairEnvelope}
                  className="w-full py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-mono text-[11px] font-bold shadow transition-all active:scale-98"
                >
                  Replace & Re-inflate Balloon Envelope
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col space-y-1.5">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-slate-300">Envelope Hoop Stress:</span>
                  <span className={`font-bold tabular-nums ${envelopeStressPct > 85 ? 'text-rose-400 animate-pulse' : envelopeStressPct > 65 ? 'text-amber-400' : 'text-sky-300'}`}>
                    {envelopeStressPct}% of 920,000 m³ Burst Limit
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-full transition-all ${envelopeStressPct > 85 ? 'bg-rose-500' : envelopeStressPct > 65 ? 'bg-amber-400' : 'bg-sky-500'}`}
                    style={{ width: `${envelopeStressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400">Rupture margin: {(100 - envelopeStressPct)}%</span>
                  <button
                    onClick={handleManualBurst}
                    className="text-[10px] font-mono text-rose-400 hover:text-rose-300 underline"
                    title="Simulate immediate envelope structural failure"
                  >
                    Test Burst
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 1: ENVIRONMENTAL VARIABLES (11 Unique Non-Repeating Parameters) */}
          <div>
            <div className="text-[11px] font-mono font-bold tracking-wider text-sky-400 uppercase mb-2.5 flex items-center justify-between">
              <span>1. Atmospheric & Wind Controls (11 Channels)</span>
              <span className="text-[10px] text-slate-400 font-normal">Physical Stress Drivers</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 1. Wind Speed */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Wind className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Wind Speed</span>
                  </span>
                  <span className="font-mono text-cyan-300 font-bold">{env.windSpeedKmh} km/h</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="1"
                  value={env.windSpeedKmh}
                  onChange={(e) => handleEnvChange('windSpeedKmh', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="text-[9px] text-slate-400 font-mono mt-1 flex justify-between">
                  <span>Drifts toward 35km border</span>
                  <span className="text-cyan-400">{env.windSpeedKmh >= 50 ? 'High Drift' : 'Nominal'}</span>
                </div>
              </div>

              {/* 2. Wind Direction */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Wind className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Wind Direction</span>
                  </span>
                  <span className="font-mono text-indigo-300 font-bold">{env.windDirectionDeg}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={env.windDirectionDeg}
                  onChange={(e) => handleEnvChange('windDirectionDeg', parseFloat(e.target.value))}
                  className="w-full accent-indigo-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                  <span>0° (N)</span>
                  <span>180° (S)</span>
                  <span>360°</span>
                </div>
              </div>

              {/* 3. Vertical Wind Velocity */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Wind className="w-3.5 h-3.5 text-teal-400" />
                    <span>Vertical Wind Vel.</span>
                  </span>
                  <span className="font-mono text-teal-300 font-bold">
                    {(env.verticalWindMps ?? 0) >= 0 ? `+${(env.verticalWindMps ?? 0).toFixed(1)}` : (env.verticalWindMps ?? 0).toFixed(1)} m/s
                  </span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={env.verticalWindMps ?? 0}
                  onChange={(e) => handleEnvChange('verticalWindMps', parseFloat(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                  <span>-15 m/s Downdraft</span>
                  <span>+15 m/s Updraft</span>
                </div>
              </div>

              {/* 4. Wind Shear */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Zap className="w-3.5 h-3.5 text-orange-400" />
                    <span>Wind Shear</span>
                  </span>
                  <span className="font-mono text-orange-300 font-bold">{(env.windShearMpsPerKm ?? 2.5).toFixed(1)} m/s/km</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="0.5"
                  value={env.windShearMpsPerKm ?? 2.5}
                  onChange={(e) => handleEnvChange('windShearMpsPerKm', parseFloat(e.target.value))}
                  className="w-full accent-orange-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                  <span>0 Calm</span>
                  <span className="text-rose-400">≥20 m/s/km Tears!</span>
                </div>
              </div>

              {/* 5. Atmospheric Pressure */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Atmospheric Pressure</span>
                  </span>
                  <span className="font-mono text-emerald-300 font-bold">{env.pressureScale.toFixed(2)}x ({Math.round(1013.25 * env.pressureScale)} hPa)</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.02"
                  value={env.pressureScale}
                  onChange={(e) => handleEnvChange('pressureScale', parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                  <span className="text-rose-400">&lt;0.88x Over-expands!</span>
                  <span>1.20x High P</span>
                </div>
              </div>

              {/* 6. Ambient Temperature */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                    <span>Ambient Temperature</span>
                  </span>
                  <span className="font-mono text-rose-300 font-bold">
                    {env.tempDeltaC >= 0 ? `+${env.tempDeltaC}` : env.tempDeltaC}°C ({atmo?.ambient_temp_c ?? 15}°C)
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={env.tempDeltaC}
                  onChange={(e) => handleEnvChange('tempDeltaC', parseFloat(e.target.value))}
                  className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                  <span className="text-rose-400">≤-28°C: Embrittlement!</span>
                  <span>+30°C Hot</span>
                </div>
              </div>

              {/* 7. Air Density */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Gauge className="w-3.5 h-3.5 text-purple-400" />
                    <span>Air Density</span>
                  </span>
                  <span className="font-mono text-purple-300 font-bold">
                    {(env.airDensityScale ?? 1.0).toFixed(2)}x ({(1.225 * (env.airDensityScale ?? 1.0)).toFixed(2)} kg/m³)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.70"
                  max="1.30"
                  step="0.02"
                  value={env.airDensityScale ?? 1.0}
                  onChange={(e) => handleEnvChange('airDensityScale', parseFloat(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                  <span>0.70x Thin Air (Low Lift)</span>
                  <span>1.30x Dense Lift</span>
                </div>
              </div>

              {/* 8. Atmospheric Turbulence */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Atmospheric Turbulence</span>
                  </span>
                  <span className="font-mono text-amber-300 uppercase font-bold text-[10px]">{env.turbulenceLevel}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {['calm', 'mild', 'severe'].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => handleEnvChange('turbulenceLevel', lvl)}
                      className={`py-1 text-[10px] font-mono uppercase rounded transition-all ${
                        env.turbulenceLevel === lvl
                          ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <div className="text-[9px] text-slate-400 font-mono mt-1">
                  <span className="text-amber-400">Severe + ≥95 km/h tears envelope!</span>
                </div>
              </div>

              {/* 9. Temperature Lapse Rate */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Thermometer className="w-3.5 h-3.5 text-pink-400" />
                    <span>Temp. Lapse Rate</span>
                  </span>
                  <span className="font-mono text-pink-300 font-bold">{(env.lapseRateCPerKm ?? -6.5).toFixed(1)} °C/km</span>
                </div>
                <input
                  type="range"
                  min="-9.8"
                  max="-3.5"
                  step="0.1"
                  value={env.lapseRateCPerKm ?? -6.5}
                  onChange={(e) => handleEnvChange('lapseRateCPerKm', parseFloat(e.target.value))}
                  className="w-full accent-pink-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                  <span className="text-rose-400">≤-8.6°C/km Cryo Burst!</span>
                  <span>-6.5 ISA Std</span>
                </div>
              </div>

              {/* 10. Solar Radiation Intensity */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Flame className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Solar Radiation</span>
                  </span>
                  <span className="font-mono text-yellow-300 font-bold">{env.solarRadiationWm2 ?? 1000} W/m²</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1400"
                  step="20"
                  value={env.solarRadiationWm2 ?? 1000}
                  onChange={(e) => handleEnvChange('solarRadiationWm2', parseFloat(e.target.value))}
                  className="w-full accent-yellow-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                  <span>0 W/m² Night</span>
                  <span className="text-rose-400">≥1320 W/m² Superheat!</span>
                </div>
              </div>

              {/* 11. Surface Relative Humidity */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Droplets className="w-3.5 h-3.5 text-blue-400" />
                    <span>Relative Humidity (Surface)</span>
                  </span>
                  <span className="font-mono text-blue-300 font-bold">{env.surfaceHumidityPct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={env.surfaceHumidityPct}
                  onChange={(e) => handleEnvChange('surfaceHumidityPct', parseFloat(e.target.value))}
                  className="w-full accent-blue-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                  <span>0% Dry Air</span>
                  <span>Modulates Cloud Opacity & Moist Air Density</span>
                  <span>100% Saturated</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: SENSOR FAULT INJECTION */}
          <div className="pt-2 border-t border-slate-800">
            <div className="text-[11px] font-mono font-bold tracking-wider text-rose-400 uppercase mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>2. Sensor Fault & Failure Mode Injection</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Real-Time Anomaly Testing</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Barometer Sticking */}
              <label className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                faults.baroStick ? 'bg-rose-950/40 border-rose-500/60 text-rose-200' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }`}>
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <span>Barometer Sticking</span>
                    {faults.baroStick && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400">Freezes pressure altitude reading</div>
                </div>
                <input
                  type="checkbox"
                  checked={faults.baroStick}
                  onChange={() => handleFaultToggle('baroStick')}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
              </label>

              {/* Barometer Drift */}
              <label className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                faults.baroDriftActive ? 'bg-rose-950/40 border-rose-500/60 text-rose-200' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }`}>
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <span>Barometer Drift</span>
                    {faults.baroDriftActive && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400">Simulates calibration random walk</div>
                </div>
                <input
                  type="checkbox"
                  checked={faults.baroDriftActive}
                  onChange={() => handleFaultToggle('baroDriftActive')}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
              </label>

              {/* IMU Noise */}
              <label className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                faults.imuNoise ? 'bg-rose-950/40 border-rose-500/60 text-rose-200' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }`}>
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <span>IMU Gyro Bias Spike</span>
                    {faults.imuNoise && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400">High variance & attitude jitter</div>
                </div>
                <input
                  type="checkbox"
                  checked={faults.imuNoise}
                  onChange={() => handleFaultToggle('imuNoise')}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
              </label>

              {/* Pitot Icing */}
              <label className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                faults.pitotIcing ? 'bg-rose-950/40 border-rose-500/60 text-rose-200' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }`}>
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <span>Pitot / Airspeed Icing</span>
                    {faults.pitotIcing && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400">Clogs dynamic pressure to near-zero</div>
                </div>
                <input
                  type="checkbox"
                  checked={faults.pitotIcing}
                  onChange={() => handleFaultToggle('pitotIcing')}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
              </label>

              {/* GPS Lock Loss */}
              <label className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                faults.gpsLoss ? 'bg-rose-950/40 border-rose-500/60 text-rose-200' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }`}>
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <span>GPS Lock Loss</span>
                    {faults.gpsLoss && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400">Simulates dropouts and null fixes</div>
                </div>
                <input
                  type="checkbox"
                  checked={faults.gpsLoss}
                  onChange={() => handleFaultToggle('gpsLoss')}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
              </label>

              {/* Telemetry Packet Loss */}
              <label className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                faults.telemetryDrop ? 'bg-rose-950/40 border-rose-500/60 text-rose-200' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }`}>
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <span>Telemetry Packet Drop</span>
                    {faults.telemetryDrop && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400">Simulates RF link fading and loss</div>
                </div>
                <input
                  type="checkbox"
                  checked={faults.telemetryDrop}
                  onChange={() => handleFaultToggle('telemetryDrop')}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
