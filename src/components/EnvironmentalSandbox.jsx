import React, { useState } from 'react';
import { Sliders, Wind, Thermometer, Droplets, Gauge, AlertTriangle, ChevronDown, ChevronUp, RotateCcw, Zap } from 'lucide-react';

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

  const activeFaultCount = Object.values(faults).filter(Boolean).length;

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
        <div className="p-4 space-y-5 text-xs text-slate-300 max-h-[calc(100vh-240px)] overflow-y-auto custom-scrollbar">
          {/* SECTION 1: ENVIRONMENTAL VARIABLES */}
          <div>
            <div className="text-[11px] font-mono font-bold tracking-wider text-sky-400 uppercase mb-3 flex items-center justify-between">
              <span>1. Atmospheric & Wind Environment</span>
              <span className="text-[10px] text-slate-400 font-normal">ISA Profile Modifiers</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Wind Speed */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
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
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                  <span>0 km/h (Calm)</span>
                  <span>Jet Stream (&gt;100)</span>
                </div>
              </div>

              {/* Wind Direction */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Wind className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Wind Bearing</span>
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
                  <span>0° (North)</span>
                  <span>180° (South)</span>
                  <span>360°</span>
                </div>
              </div>

              {/* Turbulence Intensity */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Turbulence / Shear</span>
                  </span>
                  <span className="font-mono text-amber-300 uppercase font-bold text-[10px]">{env.turbulenceLevel}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
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
              </div>

              {/* Ambient Temperature Delta */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                    <span>Temp Delta ΔT</span>
                  </span>
                  <span className="font-mono text-rose-300 font-bold">
                    {env.tempDeltaC >= 0 ? `+${env.tempDeltaC}` : env.tempDeltaC}°C
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
                  <span>-30°C (Cold Day)</span>
                  <span>+30°C (Hot Day)</span>
                </div>
              </div>

              {/* Relative Humidity */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Droplets className="w-3.5 h-3.5 text-blue-400" />
                    <span>Surface Humidity</span>
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
                  <span>0% (Dry Desert)</span>
                  <span>100% (Saturated)</span>
                </div>
              </div>

              {/* Atmospheric Pressure Scale */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pressure Scale</span>
                  </span>
                  <span className="font-mono text-emerald-300 font-bold">{env.pressureScale.toFixed(2)}x</span>
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
                  <span>0.80x (Low System)</span>
                  <span>1.0x</span>
                  <span>1.20x (High)</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: SENSOR FAULT INJECTION */}
          <div className="pt-2 border-t border-slate-800">
            <div className="text-[11px] font-mono font-bold tracking-wider text-rose-400 uppercase mb-3 flex items-center justify-between">
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
                    <span>Barometer Random Walk Drift</span>
                    {faults.baroDriftActive && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400">Simulates diaphragm creep error</div>
                </div>
                <input
                  type="checkbox"
                  checked={faults.baroDriftActive}
                  onChange={() => handleFaultToggle('baroDriftActive')}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
              </label>

              {/* IMU Noise & Gyro Spike */}
              <label className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                faults.imuNoise ? 'bg-rose-950/40 border-rose-500/60 text-rose-200' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }`}>
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <span>IMU Noise / Gyro Bias Spike</span>
                    {faults.imuNoise && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400">Random walk in pitch/roll/yaw rates</div>
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
                    <span>Pitot / Airspeed Tube Icing</span>
                    {faults.pitotIcing && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400">Clogs airspeed sensor to ~0 m/s</div>
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
                    <span>GPS Lock Loss / Dropouts</span>
                    {faults.gpsLoss && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400">Injects null fixes & position jitter</div>
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
                    <span>Telemetry Packet Loss</span>
                    {faults.telemetryDrop && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400">Simulates RF link frame dropouts</div>
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
