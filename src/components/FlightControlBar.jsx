import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Flame, Scissors, ShieldAlert, Video, ShieldCheck } from 'lucide-react';
import { CAMERA_MODES } from '../graphics/cameraModes.js';

export function FlightControlBar({
  kernel,
  cameraMode,
  setCameraMode,
  onReset,
  onUpdate,
}) {
  const [safetyOverride, setSafetyOverride] = useState(kernel.safetyOverride);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const hasLaunched = kernel.hasLaunched;
  const isRunning = kernel.isRunning;
  const timeWarp = kernel.timeWarp;
  const currentAlt = kernel.position.y;
  const isAboveSafety = currentAlt >= kernel.safetyAltitudeM || safetyOverride;
  const rocketStatus = kernel.rocket.status;
  const isAttached = kernel.isTetherAttached;

  const showFeedback = (msg, isErr = false) => {
    setFeedbackMsg({ text: msg, isErr });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleStartMission = () => {
    kernel.startMission();
    showFeedback('ROCKOON LIFT-OFF: Ground pad clamps released, ascending to stratosphere!');
    onUpdate();
  };

  const handlePauseMission = () => {
    kernel.pauseMission();
    showFeedback('MISSION HALTED: Physics, clock, and telemetry stream frozen');
    onUpdate();
  };

  const handleResumeMission = () => {
    kernel.resumeMission();
    showFeedback('MISSION RESUMED: Flight and telemetry recording active');
    onUpdate();
  };

  const handleTimeWarp = (warp) => {
    kernel.setTimeWarp(warp);
    onUpdate();
  };

  const handleSafetyToggle = () => {
    const nextVal = !safetyOverride;
    setSafetyOverride(nextVal);
    kernel.setSafetyOverride(nextVal);
    showFeedback(nextVal ? 'SAFETY INTERLOCK OVERRIDDEN' : 'SAFETY INTERLOCK ARMED (36 km)', nextVal);
    onUpdate();
  };

  const handleCutDown = () => {
    if (!isAttached) {
      showFeedback('Tether is already severed!', true);
      return;
    }
    kernel.triggerCutDown();
    showFeedback('RELEASE LATCH TRIGGERED: SBRL detached from balloon flight train');
    onUpdate();
  };

  const handleIgnition = () => {
    const res = kernel.triggerIgnition();
    showFeedback(res.reason, !res.success);
    onUpdate();
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2.5 text-xs select-none">
      {/* 1. PRIMARY LIFECYCLE CONTROLS (START / STOP / RESUME / RESTART) */}
      <div className="flex items-center space-x-2">
        {!hasLaunched ? (
          <button
            onClick={handleStartMission}
            className="px-4 py-2 rounded-xl font-mono font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30 flex items-center space-x-2 transition-all active:scale-95 animate-pulse"
            title="Launch balloon-rocket from ground launch pad"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>START MISSION (LAUNCH)</span>
          </button>
        ) : isRunning ? (
          <button
            onClick={handlePauseMission}
            className="px-3.5 py-2 rounded-xl font-mono font-bold text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 flex items-center space-x-2 transition-all active:scale-95 shadow-md"
            title="Freeze flight mechanics, clock, and telemetry downlink"
          >
            <Pause className="w-4 h-4 fill-current" />
            <span>STOP / FREEZE</span>
          </button>
        ) : (
          <button
            onClick={handleResumeMission}
            className="px-3.5 py-2 rounded-xl font-mono font-bold text-xs bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/50 flex items-center space-x-2 transition-all active:scale-95 shadow-md"
            title="Resume simulation from current frozen altitude"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>RESUME MISSION</span>
          </button>
        )}

        {/* Restart to Pad */}
        <button
          onClick={onReset}
          className="p-2 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-all flex items-center space-x-1.5 active:scale-95"
          title="Restart simulation back to ground launch pad (0 m)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="font-mono text-[11px] hidden sm:inline">RESTART</span>
        </button>

        {/* Speed Warp Multipliers */}
        <div className="flex items-center bg-slate-950/80 rounded-xl p-0.5 border border-slate-800">
          {[1, 2, 5, 10, 25, 50].map((warp) => (
            <button
              key={warp}
              onClick={() => handleTimeWarp(warp)}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all ${
                timeWarp === warp
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {warp}x
            </button>
          ))}
        </div>
      </div>

      {/* 2. CAMERA MODES SELECTOR */}
      <div className="flex items-center space-x-1 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800">
        {[
          { id: CAMERA_MODES.TRACKING_ORBIT, label: 'Orbit Cam' },
          { id: CAMERA_MODES.GROUND_TRACKER, label: 'Ground Tracker' },
          { id: CAMERA_MODES.HORIZON_WIDE, label: 'Horizon Wide' },
          { id: CAMERA_MODES.ONBOARD_POV, label: 'Onboard POV' },
        ].map((cam) => (
          <button
            key={cam.id}
            onClick={() => setCameraMode(cam.id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center space-x-1 ${
              cameraMode === cam.id
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-3 h-3" />
            <span className="hidden md:inline">{cam.label}</span>
          </button>
        ))}
      </div>

      {/* 3. FLIGHT STAGING TRIGGERS */}
      <div className="flex items-center space-x-2">
        {/* Safety Interlock Override */}
        <button
          onClick={handleSafetyToggle}
          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono flex items-center space-x-1.5 transition-all ${
            safetyOverride
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold animate-pulse'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
          title="Manual override for 36,000m minimum altitude ignition safeguard"
        >
          {safetyOverride ? <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />}
          <span className="hidden xl:inline">Safety: {safetyOverride ? 'OVERRIDE' : 'ACTIVE (36km)'}</span>
        </button>

        {/* Sever Tether / Release Latch */}
        <button
          onClick={handleCutDown}
          disabled={!isAttached || !hasLaunched}
          className={`px-3 py-1.5 rounded-xl border text-[11px] font-mono flex items-center space-x-1.5 transition-all ${
            isAttached && hasLaunched
              ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/40 active:scale-95'
              : 'bg-slate-800/40 text-slate-400 border-slate-800 cursor-not-allowed opacity-50'
          }`}
          title="Release rocket from balloon tether"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Release Latch</span>
        </button>

        {/* Manual Rocket Ignition Trigger */}
        <button
          onClick={handleIgnition}
          disabled={!hasLaunched || rocketStatus.includes('STAGE') || rocketStatus === 'COAST'}
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shadow-md ${
            rocketStatus.includes('STAGE')
              ? 'bg-rose-600/30 text-rose-400 border-rose-500/30 cursor-not-allowed'
              : isAboveSafety && hasLaunched
              ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 active:scale-95 animate-pulse'
              : 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed opacity-60'
          }`}
          title={
            !hasLaunched
              ? 'Mission must be launched from pad first'
              : !isAboveSafety
              ? 'Ignition Locked: Vehicle must reach 36,000m release window (or engage safety override)'
              : 'Ignite SBRL Stage 1 Vacuum Burn'
          }
        >
          <Flame className="w-4 h-4 fill-current" />
          <span>Stage 1 Ignition</span>
        </button>
      </div>

      {/* Floating Notification Toast */}
      {feedbackMsg && (
        <div className={`w-full py-1 px-3 rounded-lg text-[11px] font-mono text-center transition-all ${
          feedbackMsg.isErr ? 'bg-rose-950/80 border border-rose-500/60 text-rose-300' : 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-300'
        }`}>
          {feedbackMsg.text}
        </div>
      )}
    </div>
  );
}
