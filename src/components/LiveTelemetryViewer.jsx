import React, { useState } from 'react';
import { Download, FileJson, Copy, Check, X } from 'lucide-react';

export function LiveTelemetryViewer({ kernel, telemetry, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Format single telemetry record strictly according to export spec
  const currentPacket = {
    timestamp_ms: telemetry?.timestamp_ms || 0,
    flight_phase: telemetry?.flight_phase || 'PRELAUNCH',
    barometric_sensor: {
      pressure_hpa: telemetry?.barometric_sensor?.pressure_hpa || 1013.25,
      derived_altitude_m: telemetry?.barometric_sensor?.derived_altitude_m || 0.0,
      status: telemetry?.barometric_sensor?.status || 'NOMINAL'
    },
    imu_sensor: {
      accel_mps2: telemetry?.imu_sensor?.accel_mps2 || [0, 0, 9.81],
      gyro_dps: telemetry?.imu_sensor?.gyro_dps || [0, 0, 0],
      attitude_rpy_deg: telemetry?.imu_sensor?.attitude_rpy_deg || [0, 90, 0],
      status: telemetry?.imu_sensor?.status || 'NOMINAL'
    },
    environmental_sensors: {
      ambient_temp_c: telemetry?.environmental_sensors?.ambient_temp_c || 15.0,
      relative_humidity_pct: telemetry?.environmental_sensors?.relative_humidity_pct || 65.0,
      effective_wind_vector_mps: telemetry?.environmental_sensors?.effective_wind_vector_mps || [0, 0, 0]
    },
    payload_state: {
      is_attached: telemetry?.payload_state?.is_attached ?? true,
      balloon_volume_m3: telemetry?.payload_state?.balloon_volume_m3 || 5200.0,
      thrust_n: telemetry?.payload_state?.thrust_n || 0.0
    }
  };

  const jsonString = JSON.stringify(currentPacket, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportFull = () => {
    const fullExport = kernel.getExportJson();
    const blob = new Blob([JSON.stringify(fullExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aeroin_sbrl_telemetry_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 z-50 flex flex-col shadow-2xl transition-all">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileJson className="w-5 h-5 text-sky-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100 font-mono">Live Telemetry Inspector</h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Buffer: {kernel.telemetryBuffer.length} records ({kernel.sampleRateHz} Hz sampling)
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sampling Rate Selector Bar */}
      <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400 font-mono">Downlink Rate:</span>
        <div className="flex items-center space-x-2">
          {[10, 50].map((rate) => (
            <button
              key={rate}
              onClick={() => { kernel.sampleRateHz = rate; }}
              className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-all ${
                kernel.sampleRateHz === rate
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {rate} Hz
            </button>
          ))}
        </div>
      </div>

      {/* Live JSON Viewer Body */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] bg-slate-950/80 custom-scrollbar">
        <div className="flex justify-between items-center mb-2 text-slate-400 text-[10px]">
          <span>CURRENT DOWNLINK FRAME:</span>
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 text-sky-400 hover:text-sky-300 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy Frame'}</span>
          </button>
        </div>

        <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-sky-200 overflow-x-auto leading-relaxed">
          {jsonString}
        </pre>
      </div>

      {/* Footer with Export Button */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
        <div className="text-[11px] text-slate-400 font-mono">
          Ready to export {kernel.telemetryBuffer.length} frames
        </div>

        <button
          onClick={handleExportFull}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center space-x-2 shadow-lg active:scale-95 transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Export Mission Telemetry (.json)</span>
        </button>
      </div>
    </div>
  );
}
