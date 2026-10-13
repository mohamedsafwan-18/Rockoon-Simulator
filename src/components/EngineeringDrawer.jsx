import React, { useState } from 'react';
import { Compass, TrendingUp, Sliders, FileJson, ChevronRight, ChevronLeft, Download, X, WifiOff } from 'lucide-react';
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
  tcpStatus,
  isPinging = true,
  onStartPing,
  onStopPing,
  onStopPing10s,
  pingPausedState,
}) {
  const [internalActiveTab, setInternalActiveTab] = useState(DRAWER_TABS.INSTRUMENTS);
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = onSelectTab || setInternalActiveTab;
  const [copied, setCopied] = useState(false);
  const [copiedPingPaused, setCopiedPingPaused] = useState(false);

  const is10sStageActive = Boolean(pingPausedState?.active);
  const pingPausedVal = is10sStageActive ? 1 : 0;

  // Separate "ping paused" JSON (1 when in 10s stop-ping stage, 0 otherwise)
  const pingPausedJsonObject = kernel?.getPingPausedJson
    ? kernel.getPingPausedJson()
    : {
        ping_paused: pingPausedVal,
        'ping paused': pingPausedVal,
      };
  const pingPausedJsonString = JSON.stringify(pingPausedJsonObject, null, 2);

  // Formatted JSON frame with Pause/Resume state, 0.5s TCP Socket header info, 3D GNSS Launch-Pad-Origin coordinates & advanced physics
  const currentPacket = {
    event: 'device_handshake',
    device_id: 'client_node_01',
    ping_paused: pingPausedVal,
    'ping paused': pingPausedVal,
    ping_paused_json: pingPausedJsonObject,
    timestamp_ms: telemetry?.timestamp_ms || 0,
    simulation_state: telemetry?.simulation_state || {
      status: kernel.missionStatus || 'PRELAUNCH',
      is_running: kernel.isRunning,
      is_paused: kernel.isPaused,
      is_resumed: kernel.isResumed,
      is_pinging: kernel.isPinging,
      ping_paused: pingPausedVal,
      'ping paused': pingPausedVal,
      predictive_10s_deviation_active: is10sStageActive,
      predictive_10s_remaining_sec: pingPausedState?.remainingSec || 0,
      has_launched: kernel.hasLaunched,
      pause_count: kernel.pauseCount || 0,
      resume_count: kernel.resumeCount || 0,
      last_action: kernel.lastControlAction || 'INITIALIZED',
      pause_resume_events: kernel.pauseResumeEvents || [],
    },
    tcp_socket_stream: {
      server_ip: '172.16.59.95',
      port: 65432,
      ping_interval_seconds: 0.5,
      is_pinging: isPinging,
      ping_paused: pingPausedVal,
      'ping paused': pingPausedVal,
      predictive_telemetry_mode: is10sStageActive
        ? 'PREDICTIVE_DEVIATION_ACTIVE_10S'
        : 'LIVE_SENSOR_STREAM',
      protocol: '4-byte Big-Endian uint32 (!I) length header + UTF-8 JSON',
      packets_dispatched: tcpStatus?.totalPingsSent || 0,
      socket_status: isPinging ? tcpStatus?.status || 'PINGING_0.5S' : 'PING_STOPPED',
      last_server_ack: tcpStatus?.lastAck || null,
    },
    flight_phase: telemetry?.flight_phase || 'PRELAUNCH',
    staging_sub_phase: telemetry?.staging_sub_phase || 'ATTACHED_TO_GONDOLA',
    gnss_coordinates: telemetry?.gnss_coordinates || {
      origin: 'chennailaunchpad',
      origin_reference: 'chennailaunchpad',
      launch_site: 'Chennai Launch Pad, India (13.0827°N, 80.2707°E)',
      position_from_origin_xyz_m: [0, 0, 0],
      x_downrange_m: 0,
      y_altitude_m: 0,
      z_crossrange_m: 0,
      slant_range_3d_m: 0,
      geodetic_wgs84: {
        origin: 'chennailaunchpad',
        lat_deg: 13.0827,
        lon_deg: 80.2707,
        alt_m: 0,
        latitude_deg: 13.0827,
        longitude_deg: 80.2707,
        altitude_msl_m: 0,
      },
    },
    orbital_and_aerothermal_physics: telemetry?.orbital_and_aerothermal_physics || {
      specific_orbital_energy_mj_kg: -62.55,
      specific_angular_momentum_m2s: 0,
      semi_major_axis_km: 0,
      eccentricity: 1.0,
      remaining_delta_v_mps: 9150,
      dynamic_pressure_q_pa: 0,
      max_q_pa: 0,
      aerodynamic_heat_flux_wm2: 0,
      membrane_hoop_stress_mpa: 0,
      differential_superpressure_pa: 0,
    },
    barometric_sensor: {
      pressure_hpa: telemetry?.barometric_sensor?.pressure_hpa || 1013.25,
      derived_altitude_m: telemetry?.barometric_sensor?.derived_altitude_m || 0.0,
      status: telemetry?.barometric_sensor?.status || 'NOMINAL',
    },
    imu_sensor: {
      accel_mps2: telemetry?.imu_sensor?.accel_mps2 || [0, 0, 9.81],
      gyro_dps: telemetry?.imu_sensor?.gyro_dps || [0, 0, 0],
      attitude_rpy_deg: telemetry?.imu_sensor?.attitude_rpy_deg || [0, 90, 0],
      status: telemetry?.imu_sensor?.status || 'NOMINAL',
    },
    environmental_sensors: {
      ambient_temp_c: telemetry?.environmental_sensors?.ambient_temp_c || 15.0,
      relative_humidity_pct: telemetry?.environmental_sensors?.relative_humidity_pct || 65.0,
      effective_wind_vector_mps: telemetry?.environmental_sensors?.effective_wind_vector_mps || [0, 0, 0],
    },
    payload_state: {
      is_attached: telemetry?.payload_state?.is_attached ?? true,
      balloon_volume_m3: telemetry?.payload_state?.balloon_volume_m3 || 4200.0,
      thrust_n: telemetry?.payload_state?.thrust_n || 0.0,
    },
  };

  const jsonString = JSON.stringify(currentPacket, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPingPaused = () => {
    navigator.clipboard.writeText(pingPausedJsonString);
    setCopiedPingPaused(true);
    setTimeout(() => setCopiedPingPaused(false), 2000);
  };

  const handleExportPingPausedJson = () => {
    const blob = new Blob([pingPausedJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ping_paused.json';
    a.click();
    URL.revokeObjectURL(url);
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
                {/* 0.5s TCP Socket Stream Status Card (172.16.59.95:65432) */}
                <div className="bg-slate-900/95 p-2.5 rounded-lg border border-sky-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          is10sStageActive
                            ? 'bg-amber-400 animate-ping'
                            : isPinging
                            ? 'bg-emerald-400 animate-ping'
                            : 'bg-rose-500'
                        }`}
                      />
                      TCP SOCKET: 172.16.59.95:65432
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                        is10sStageActive
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : isPinging
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {is10sStageActive
                        ? `PREDICTIVE 10s (${pingPausedState?.remainingSec?.toFixed(1) || '10.0'}s)`
                        : isPinging
                        ? 'PINGING (0.5s)'
                        : 'PING STOPPED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-300">
                    <span>
                      Pings Sent: <strong className="text-emerald-300">{tcpStatus?.totalPingsSent || 0}</strong>
                    </span>
                    <span>
                      Sim State:{' '}
                      <strong
                        className={
                          kernel.isPaused
                            ? 'text-amber-300'
                            : kernel.isResumed
                            ? 'text-emerald-300'
                            : 'text-sky-300'
                        }
                      >
                        {kernel.missionStatus}
                      </strong>{' '}
                      (P:{kernel.pauseCount}/R:{kernel.resumeCount})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={onStartPing}
                      disabled={isPinging}
                      className={`px-3 py-1.5 rounded border text-[11px] font-bold transition-all ${
                        isPinging
                          ? 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed'
                          : 'bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border-emerald-500/50 active:scale-98'
                      }`}
                    >
                      ▶ Start Ping
                    </button>

                    {/* Stop Ping Option — Icon-only No-Internet Icon (Text Removed) */}
                    <button
                      onClick={onStopPing}
                      disabled={!isPinging}
                      aria-label="Stop Ping"
                      title="Stop Ping (No Internet Icon)"
                      className={`px-3 py-1.5 rounded border flex items-center justify-center transition-all ${
                        !isPinging
                          ? 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed'
                          : 'bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 border-rose-500/50 active:scale-98'
                      }`}
                    >
                      <WifiOff className="w-4 h-4" />
                    </button>

                    {/* Stop ping for 10 secs — Does NOT stop ping; slightly deviates telemetry as predicted */}
                    <button
                      onClick={onStopPing10s}
                      title="Does not actually stop pinging — slightly deviates telemetry data for 10s as if predicted & sets ping_paused JSON to 1"
                      className={`flex-1 py-1.5 px-2 rounded border text-[10px] font-bold transition-all ${
                        is10sStageActive
                          ? 'bg-amber-500/30 text-amber-200 border-amber-400/70 animate-pulse'
                          : 'bg-amber-600/20 hover:bg-amber-600/35 text-amber-300 border-amber-500/40 active:scale-98'
                      }`}
                    >
                      {is10sStageActive
                        ? `Stop ping for 10 secs (${pingPausedState?.remainingSec?.toFixed(1) || '10.0'}s)`
                        : 'Stop ping for 10 secs'}
                    </button>
                  </div>
                </div>

                {/* Dedicated "ping paused" JSON Block (1 during 10s stop-ping stage, 0 otherwise) */}
                <div
                  className={`p-2.5 rounded-lg border space-y-1.5 transition-all ${
                    is10sStageActive
                      ? 'bg-amber-950/35 border-amber-500/60'
                      : 'bg-slate-900/90 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span>PING PAUSED JSON (ping_paused.json):</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                          is10sStageActive
                            ? 'bg-amber-500/30 text-amber-200 border-amber-400/60'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        VALUE = {pingPausedVal}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyPingPaused}
                        className="text-sky-400 hover:text-sky-300 text-[10px]"
                      >
                        {copiedPingPaused ? '✓ Copied' : 'Copy JSON'}
                      </button>
                      <button
                        onClick={handleExportPingPausedJson}
                        className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold"
                      >
                        Export ping_paused.json
                      </button>
                    </div>
                  </div>
                  <pre className="p-2 rounded bg-slate-950/90 border border-slate-800 text-amber-200 text-[11px] leading-snug">
                    {pingPausedJsonString}
                  </pre>
                </div>

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
                  <span>DOWNLINK PACKET FRAME (0.5s TCP PAYLOAD):</span>
                  <button
                    onClick={handleCopy}
                    className="text-sky-400 hover:text-sky-300 flex items-center space-x-1 transition-colors"
                  >
                    <span>{copied ? '✓ Copied' : 'Copy Packet'}</span>
                  </button>
                </div>

                <pre className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-sky-200 text-[11px] max-h-60 overflow-auto custom-scrollbar leading-relaxed">
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
