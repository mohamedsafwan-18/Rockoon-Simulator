import React, { useState } from 'react';
import { Compass, TrendingUp, Sliders, FileJson, ChevronRight, ChevronLeft, Download, X } from 'lucide-react';
import { PrimaryFlightDisplay } from './PrimaryFlightDisplay.jsx';
import { TelemetryGraphs } from './TelemetryGraphs.jsx';
import { EnvironmentalSandbox } from './EnvironmentalSandbox.jsx';

export const DRAWER_TABS = {
  INSTRUMENTS: 'INSTRUMENTS',
  CHARTS: 'CHARTS',
  SANDBOX: 'SANDBOX',
  JSON: 'JSON',
};

export function EngineeringDrawer({
  kernel,
  telemetry,
  isOpen,
  onToggle,
  activeTab: controlledActiveTab,
  onSelectTab,
  onExportJson,
  onUpdate,
}) {
  const [internalActiveTab, setInternalActiveTab] = useState(DRAWER_TABS.INSTRUMENTS);
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = onSelectTab || setInternalActiveTab;
  const [copied, setCopied] = useState(false);

  // Formatted JSON frame
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
      balloon_volume_m3: telemetry?.payload_state?.balloon_volume_m3 || 4200.0,
      thrust_n: telemetry?.payload_state?.thrust_n || 0.0
    }
  };

  const jsonString = JSON.stringify(currentPacket, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeFaultCount = Object.values(kernel.faults || {}).filter(Boolean).length;

  return (
    <aside
      className={`fixed top-14 bottom-24 right-3 z-40 transition-all duration-300 ease-in-out flex items-start pointer-events-auto ${
        isOpen ? 'w-[440px] sm:w-[500px]' : 'w-12'
      }`}
    >
      {/* Collapse / Expand Toggle Button Pill */}
      <button
        onClick={onToggle}
        className="h-12 w-9 rounded-l-xl bg-slate-900/95 hover:bg-slate-800 text-sky-400 border-y border-l border-slate-700/80 shadow-2xl flex items-center justify-center transition-all select-none focus:outline-none"
        title={isOpen ? 'Collapse Engineering Drawer' : 'Open Engineering Drawer'}
      >
        {isOpen ? <ChevronRight className="w-5 h-5 text-slate-300" /> : <ChevronLeft className="w-5 h-5 text-sky-400" />}
      </button>

      {/* Main Drawer Body */}
      {isOpen ? (
        <div className="w-full h-full bg-slate-950/95 backdrop-blur-xl border border-slate-800/90 rounded-r-2xl rounded-bl-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Drawer Top Tab Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 select-none">
            <div className="flex items-center space-x-1 overflow-x-auto text-xs font-mono">
              <button
                onClick={() => setActiveTab(DRAWER_TABS.INSTRUMENTS)}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
                  activeTab === DRAWER_TABS.INSTRUMENTS
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Instruments</span>
              </button>

              <button
                onClick={() => setActiveTab(DRAWER_TABS.CHARTS)}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
                  activeTab === DRAWER_TABS.CHARTS
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Strip Charts</span>
              </button>

              <button
                onClick={() => setActiveTab(DRAWER_TABS.SANDBOX)}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 relative transition-all ${
                  activeTab === DRAWER_TABS.SANDBOX
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Sandbox</span>
                {activeFaultCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1 right-1" />
                )}
              </button>

              <button
                onClick={() => setActiveTab(DRAWER_TABS.JSON)}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
                  activeTab === DRAWER_TABS.JSON
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </div>

            <button
              onClick={onToggle}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content Area */}
          <div className="flex-1 p-3.5 overflow-y-auto custom-scrollbar min-h-0 space-y-3">
            {/* TAB 1: PFD & INSTRUMENTS */}
            {activeTab === DRAWER_TABS.INSTRUMENTS && (
              <div className="space-y-3">
                <PrimaryFlightDisplay telemetry={telemetry} kernel={kernel} />
              </div>
            )}

            {/* TAB 2: SPLIT-PANE STRIP CHARTS */}
            {activeTab === DRAWER_TABS.CHARTS && (
              <div className="space-y-3">
                <TelemetryGraphs kernel={kernel} />
              </div>
            )}

            {/* TAB 3: ENVIRONMENTAL SANDBOX & SENSOR FAULT INJECTION */}
            {activeTab === DRAWER_TABS.SANDBOX && (
              <div>
                <EnvironmentalSandbox kernel={kernel} onUpdate={onUpdate} />
              </div>
            )}

            {/* TAB 4: LIVE JSON DOWNLINK INSPECTOR */}
            {activeTab === DRAWER_TABS.JSON && (
              <div className="space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-300 text-[11px]">
                    Downlink: <strong className="text-sky-300">{kernel.sampleRateHz} Hz</strong> | Buffered:{' '}
                    <strong className="text-emerald-300">{kernel.telemetryBuffer.length} frames</strong>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {[10, 50].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          kernel.sampleRateHz = rate;
                          onUpdate();
                        }}
                        className={`px-2 py-0.5 rounded border text-[10px] ${
                          kernel.sampleRateHz === rate
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {rate} Hz
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>DOWNLINK PACKET FRAME:</span>
                  <button
                    onClick={handleCopy}
                    className="text-sky-400 hover:text-sky-300 flex items-center space-x-1 transition-colors"
                  >
                    <span>{copied ? '✓ Copied' : 'Copy Packet'}</span>
                  </button>
                </div>

                <pre className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-sky-200 text-[11px] max-h-72 overflow-auto custom-scrollbar leading-relaxed">
                  {jsonString}
                </pre>

                <button
                  onClick={onExportJson}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Mission Telemetry (.json)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Collapsed mini vertical quick tab rail */
        <div className="h-full w-12 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-r-xl rounded-bl-xl shadow-xl flex flex-col items-center py-4 space-y-4">
          <button
            onClick={() => { setActiveTab(DRAWER_TABS.INSTRUMENTS); onToggle(); }}
            className="p-2 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors"
            title="Open Instruments"
          >
            <Compass className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setActiveTab(DRAWER_TABS.CHARTS); onToggle(); }}
            className="p-2 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
            title="Open Strip Charts"
          >
            <TrendingUp className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setActiveTab(DRAWER_TABS.SANDBOX); onToggle(); }}
            className="p-2 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 relative transition-colors"
            title="Open Sandbox"
          >
            <Sliders className="w-5 h-5" />
            {activeFaultCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1 right-1" />}
          </button>
          <button
            onClick={() => { setActiveTab(DRAWER_TABS.JSON); onToggle(); }}
            className="p-2 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors"
            title="Open Live JSON"
          >
            <FileJson className="w-5 h-5" />
          </button>
        </div>
      )}
    </aside>
  );
}
