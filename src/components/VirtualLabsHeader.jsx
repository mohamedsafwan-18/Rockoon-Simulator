import React from 'react';
import { Rocket, Download, Activity, Radio, Cpu, Compass, Sliders, TrendingUp, FileJson, Wifi, WifiOff } from 'lucide-react';
import { DRAWER_TABS } from './EngineeringDrawer.jsx';

export function VirtualLabsHeader({
  telemetry,
  onExportJson,
  onOpenDrawerTab,
  activeDrawerTab,
  isDrawerOpen,
  activeFaultCount = 0,
  tcpStatus,
  isPinging = true,
  onTogglePing,
  onStopPing10s,
  pingPausedState,
}) {
  const formatMet = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
  };

  const phase = telemetry?.flight_phase || 'PRELAUNCH';
  const simStatus = telemetry?.simulation_state?.status || 'PRELAUNCH';
  const baroStatus = telemetry?.barometric_sensor?.status || 'NOMINAL';
  const imuStatus = telemetry?.imu_sensor?.status || 'NOMINAL';
  const gpsStatus = telemetry?.navigation_state?.status || 'NOMINAL';
  const linkStatus = telemetry?.navigation_state?.transceiver_status || 'NOMINAL';
  const is10sStage = Boolean(pingPausedState?.active);

  const getStatusBadge = (status) => {
    if (status === 'NOMINAL') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    if (status === 'DEGRADED') return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    if (status === 'PREDICTED_ESTIMATOR') return 'bg-amber-500/30 text-amber-200 border-amber-400 animate-pulse';
    return 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse';
  };

  const getPhaseBadge = (p) => {
    if (p === 'LEO_ORBIT') return 'bg-amber-500/30 text-amber-300 border-amber-400 font-bold shadow-lg animate-pulse';
    if (p.includes('BURST') || p.includes('IMPACT') || p.includes('FREE_FALL')) return 'bg-rose-600/40 text-rose-200 border-rose-500 animate-pulse font-bold';
    if (p.includes('STAGE') || p.includes('IGNITION')) return 'bg-rose-600/30 text-rose-300 border-rose-500/50';
    if (p.includes('STRATO') || p.includes('FLOAT') || p.includes('RELEASE')) return 'bg-sky-600/30 text-sky-300 border-sky-500/50';
    if (p.includes('JET')) return 'bg-amber-600/30 text-amber-300 border-amber-500/50';
    return 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50';
  };

  const isSafezoneViolated = !telemetry?.range_safety?.is_inside_safezone && phase !== 'PRELAUNCH' && phase !== 'LEO_ORBIT';
  const isBurst = telemetry?.payload_state?.is_balloon_burst;

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none shadow-md">
      {/* Left: Branding & V-Labs Identity */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-400">
            <Rocket className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black tracking-widest text-sky-400 font-mono">V-LABS AEROSPACE</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">DIGITAL TWIN</span>
            </div>
            <h1 className="text-sm font-semibold text-slate-100 tracking-tight flex items-center gap-1.5">
              Aeroin SpaceTech SBRL <span className="text-xs font-normal text-sky-400 font-mono hidden md:inline">Pyramidal Launcher (36-40 km)</span>
            </h1>
          </div>
        </div>

        {/* Phase Pill */}
        <div className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold tracking-wider ${getPhaseBadge(phase)}`}>
          {phase}
        </div>

        {/* Simulation Pause / Resume Status Pill */}
        {simStatus === 'PAUSED' && (
          <div className="px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-400 text-amber-300 text-[10px] font-mono font-bold animate-pulse">
            ⏸ PAUSED
          </div>
        )}
        {simStatus === 'RESUMED' && (
          <div className="px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/60 text-emerald-300 text-[10px] font-mono font-bold">
            ▶ RESUMED
          </div>
        )}

        {/* Airspace Safezone Warning Flag */}
        {isSafezoneViolated && (
          <div className="hidden sm:flex items-center px-2 py-0.5 rounded-full bg-rose-600/30 border border-rose-500 text-rose-300 text-[10px] font-mono font-bold animate-pulse">
            <span>⚠️ ILLEGAL LAUNCH (AIRSPACE VIOLATION)</span>
          </div>
        )}

        {/* Balloon Burst Warning Flag */}
        {isBurst && (
          <div className="hidden sm:flex items-center px-2 py-0.5 rounded-full bg-rose-600/30 border border-rose-500 text-rose-300 text-[10px] font-mono font-bold animate-pulse">
            <span>💥 ENVELOPE BURST</span>
          </div>
        )}
      </div>

      {/* Center: Mission Elapsed Time & Subsystem Health Badges */}
      <div className="hidden xl:flex items-center space-x-5">
        <div className="flex items-center space-x-2 font-mono">
          <span className="text-xs text-slate-400">MET:</span>
          <span className="text-sm font-bold text-sky-300 tabular-nums tracking-wider bg-slate-950/80 px-2.5 py-0.5 rounded border border-slate-800">
            {formatMet(telemetry?.timestamp_ms || 0)}
          </span>
        </div>

        {/* Subsystem Health Status Indicators */}
        <div className="flex items-center space-x-1.5 text-[11px] font-mono">
          <div className={`flex items-center space-x-1 px-2 py-0.5 rounded border ${getStatusBadge(baroStatus)}`}>
            <Activity className="w-3 h-3" />
            <span>BARO</span>
          </div>
          <div className={`flex items-center space-x-1 px-2 py-0.5 rounded border ${getStatusBadge(imuStatus)}`}>
            <Cpu className="w-3 h-3" />
            <span>IMU</span>
          </div>
          <div className={`flex items-center space-x-1 px-2 py-0.5 rounded border ${getStatusBadge(gpsStatus)}`}>
            <Compass className="w-3 h-3" />
            <span>GPS</span>
          </div>
          <div className={`flex items-center space-x-1 px-2 py-0.5 rounded border ${getStatusBadge(linkStatus)}`}>
            <Radio className="w-3 h-3" />
            <span>RF LINK</span>
          </div>
          {/* No-Internet Icon Button (Stop / Toggle Ping — Icon Only, No Text) */}
          <button
            onClick={onTogglePing}
            aria-label="Stop Ping"
            className={`cursor-pointer flex items-center justify-center p-1.5 rounded border transition-all active:scale-95 ${
              isPinging
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30'
                : 'bg-slate-800 text-rose-400 border-rose-500/60 hover:bg-slate-700'
            }`}
            title={
              isPinging
                ? `Stop Ping (10.110.76.5:65431 | Sent: ${tcpStatus?.totalPingsSent || 0})`
                : 'Ping Stopped — Click to Start Ping (10.110.76.5:65431)'
            }
          >
            <WifiOff className="w-3.5 h-3.5" />
          </button>

          {/* "Stop ping for 10 secs" Button (Keeps pinging, slightly deviates telemetry as predicted, sets ping_paused = 1) */}
          <button
            onClick={onStopPing10s}
            className={`cursor-pointer flex items-center space-x-1 px-2 py-0.5 rounded border font-bold transition-all active:scale-95 ${
              is10sStage
                ? 'bg-amber-500/30 text-amber-200 border-amber-400 animate-pulse'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
            }`}
            title="Keeps pinging 10.110.76.5:65431 while slightly deviating telemetry data as predicted for 10s (ping_paused = 1)"
          >
            <span>
              {is10sStage
                ? `Stop ping for 10 secs (${pingPausedState.remainingSec.toFixed(0)}s | ping_paused:1)`
                : 'Stop ping for 10 secs'}
            </span>
          </button>
        </div>
      </div>

      {/* Right: Drawer Tab Switchers & Export */}
      <div className="flex items-center space-x-1.5">
        {/* Quick Drawer Tabs */}
        <div className="hidden sm:flex items-center bg-slate-950/80 rounded-lg p-0.5 border border-slate-800 text-xs font-mono">
          <button
            onClick={() => onOpenDrawerTab(DRAWER_TABS.INSTRUMENTS)}
            className={`px-2.5 py-1 rounded flex items-center space-x-1 transition-all ${
              isDrawerOpen && activeDrawerTab === DRAWER_TABS.INSTRUMENTS
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Open Flight Instruments Display"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Instruments</span>
          </button>

          <button
            onClick={() => onOpenDrawerTab(DRAWER_TABS.CHARTS)}
            className={`px-2.5 py-1 rounded flex items-center space-x-1 transition-all ${
              isDrawerOpen && activeDrawerTab === DRAWER_TABS.CHARTS
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Open Telemetry Strip Charts"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Charts</span>
          </button>

          <button
            onClick={() => onOpenDrawerTab(DRAWER_TABS.SANDBOX)}
            className={`px-2.5 py-1 rounded flex items-center space-x-1 relative transition-all ${
              isDrawerOpen && activeDrawerTab === DRAWER_TABS.SANDBOX
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Open Environmental Sandbox & Fault Injections"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Sandbox</span>
            {activeFaultCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-0.5 right-0.5" />
            )}
          </button>

          <button
            onClick={() => onOpenDrawerTab(DRAWER_TABS.JSON)}
            className={`px-2.5 py-1 rounded flex items-center space-x-1 transition-all ${
              isDrawerOpen && activeDrawerTab === DRAWER_TABS.JSON
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Inspect Live Telemetry JSON Stream & 0.5s TCP Socket Pinger"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">JSON</span>
          </button>
        </div>

        {/* Export JSON Button */}
        <button
          onClick={onExportJson}
          className="px-2.5 py-1.5 text-xs font-mono rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1.5 transition-all shadow-sm active:scale-95"
          title="Export complete mission telemetry records to .json file"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Export</span>
        </button>
      </div>
    </header>
  );
}
