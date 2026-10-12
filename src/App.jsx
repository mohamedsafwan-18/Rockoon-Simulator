import React, { useState, useEffect, useCallback } from 'react';
import { SimulationKernel } from './physics/simulationKernel.js';
import { ThreeScene } from './graphics/ThreeScene.jsx';
import { CAMERA_MODES } from './graphics/cameraModes.js';
import { VirtualLabsHeader } from './components/VirtualLabsHeader.jsx';
import { EngineeringDrawer, DRAWER_TABS } from './components/EngineeringDrawer.jsx';
import { FlightControlBar } from './components/FlightControlBar.jsx';
import { TheoryDrawer } from './components/TheoryDrawer.jsx';
import { Compass, Wind, Thermometer, Gauge, ChevronRight } from 'lucide-react';

export function App() {
  const [kernel] = useState(() => new SimulationKernel());
  const [telemetry, setTelemetry] = useState(() => kernel.generateSensorReadings());
  const [cameraMode, setCameraMode] = useState(CAMERA_MODES.TRACKING_ORBIT);
  const [isTheoryOpen, setIsTheoryOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState(DRAWER_TABS.INSTRUMENTS);
  const [, setForceTick] = useState(0);

  const forceUpdate = useCallback(() => {
    setForceTick(t => t + 1);
  }, []);

  // Main high-frequency simulation integration loop
  useEffect(() => {
    let animId;
    let lastTime = performance.now();
    let lastUiUpdate = 0;

    const loop = (currentTime) => {
      animId = requestAnimationFrame(loop);

      const rawDt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Clamp max dt to prevent numerical instability if window is backgrounded
      const clampedDt = Math.min(0.1, Math.max(0.001, rawDt));

      if (kernel.isRunning) {
        // Apply time warp multiplier
        const effectiveDt = clampedDt * kernel.timeWarp;
        kernel.integrate(effectiveDt);
      }

      // Throttle React state updates to ~25 Hz for smooth UI without DOM rendering bottlenecks
      if (currentTime - lastUiUpdate > 40) {
        lastUiUpdate = currentTime;
        setTelemetry(kernel.generateSensorReadings());
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [kernel]);

  const handleReset = () => {
    kernel.reset();
    setTelemetry(kernel.generateSensorReadings());
    forceUpdate();
  };

  const handleExportJson = () => {
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

  const handleOpenDrawerTab = (tab) => {
    setActiveDrawerTab(tab);
    setIsDrawerOpen(true);
  };

  const activeFaultCount = Object.values(kernel.faults || {}).filter(Boolean).length;
  const altitude = telemetry?.barometric_sensor?.true_altitude_m ?? kernel.position.y;
  const climbRate = kernel.velocity.vy || 0;
  const airspeed = telemetry?.navigation_state?.measured_airspeed_mps || 0;
  const pressureHpa = telemetry?.barometric_sensor?.pressure_hpa || 1013.25;
  const ambientTempC = telemetry?.environmental_sensors?.ambient_temp_c || 15.0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 flex flex-col font-sans select-none">
      {/* 1. TOP HEADER NAVIGATION BAR */}
      <VirtualLabsHeader
        telemetry={telemetry}
        onOpenTheory={() => setIsTheoryOpen(true)}
        onExportJson={handleExportJson}
        onOpenDrawerTab={handleOpenDrawerTab}
        activeDrawerTab={activeDrawerTab}
        isDrawerOpen={isDrawerOpen}
        activeFaultCount={activeFaultCount}
      />

      {/* 2. FULLSCREEN 3D SIMULATOR VIEWPORT */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Fullscreen Three.js WebGL Canvas */}
        <div className="absolute inset-0 z-0">
          <ThreeScene kernel={kernel} cameraMode={cameraMode} setCameraMode={setCameraMode} />
        </div>

        {/* 3. NON-INTRUSIVE FLOATING MINI-HUD OVERLAY (TOP-LEFT) */}
        <div className="absolute top-4 left-4 z-20 pointer-events-auto">
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800/90 rounded-2xl p-3 shadow-2xl flex flex-col space-y-2 text-xs font-mono min-w-[210px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                <span>SBRL DIGITAL TWIN</span>
              </span>
              <button
                onClick={() => {
                  setActiveDrawerTab(DRAWER_TABS.INSTRUMENTS);
                  setIsDrawerOpen(prev => !prev);
                }}
                className="text-[10px] text-slate-400 hover:text-sky-300 flex items-center transition-colors"
                title="Toggle Instruments Drawer"
              >
                <span>{isDrawerOpen ? 'Close' : 'Details'}</span>
                <ChevronRight className="w-3 h-3 ml-0.5" />
              </button>
            </div>

            {/* Balloon Burst Alert */}
            {kernel.isBalloonBurst && (
              <div className="py-1 px-2 rounded bg-rose-950/80 border border-rose-500 text-rose-300 text-[10px] font-bold animate-pulse">
                💥 ENVELOPE BURST: FREE FALL
              </div>
            )}

            {/* Safezone Airspace Violation Alert */}
            {!kernel.isInsideSafezone && kernel.hasLaunched && kernel.rocket.status !== 'LEO_ORBIT' && (
              <div className="py-1 px-2 rounded bg-rose-950/80 border border-rose-500 text-rose-300 text-[10px] font-bold animate-pulse">
                ⚠️ AIRSPACE SAFEZONE VIOLATED (Drift: {(kernel.currentDriftM / 1000).toFixed(1)} km)
              </div>
            )}

            {/* Orbit Insertion Failure Alert */}
            {kernel.rocket.status === 'ORBIT_INSERTION_FAILURE' && (
              <div className="py-1 px-2 rounded bg-orange-950/90 border border-orange-500 text-orange-300 text-[10px] font-bold animate-pulse">
                ⚠️ ORBIT INSERTION FAILED: SUBORBITAL DECAY
              </div>
            )}

            {/* Auto-1x Speed at 34 km Notification */}
            {kernel.hasAutoSlowedAt34km && altitude >= 34000 && altitude <= 41000 && kernel.timeWarp === 1 && (
              <div className="py-1 px-2 rounded bg-sky-950/80 border border-sky-500/60 text-sky-300 text-[10px] font-bold">
                ⏱️ 34 KM REACHED: SPEED SET TO 1x
              </div>
            )}

            {/* In Orbit Badge */}
            {kernel.rocket.status === 'LEO_ORBIT' && (
              <div className="py-1 px-2 rounded bg-amber-950/80 border border-amber-400 text-amber-300 text-[10px] font-bold shadow-lg animate-pulse">
                🛰️ LOW EARTH ORBIT (LEO) INSERTION CONFIRMED
              </div>
            )}

            {/* Altitude & Variometer */}
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400 text-[11px]">Altitude (Y):</span>
              <span className="text-sm font-bold text-sky-300 tabular-nums">
                {Math.round(altitude)} <span className="text-[10px] font-normal text-slate-400">m</span>
                <span className="text-[10px] text-slate-500 ml-1">({(altitude / 1000).toFixed(1)} km)</span>
              </span>
            </div>

            {/* Climb Rate / Orbital Speed */}
            {kernel.rocket.status === 'LEO_ORBIT' ? (
              <div className="flex justify-between items-baseline">
                <span className="text-slate-400 text-[11px]">Orbital Speed:</span>
                <span className="text-xs font-bold text-amber-400 tabular-nums">
                  {Math.round(kernel.rocket.orbitalVelocityMps)} <span className="text-[10px] font-normal text-slate-400">m/s (Mach 26)</span>
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-baseline">
                <span className="text-slate-400 text-[11px]">Climb Rate:</span>
                <span className={`text-xs font-bold tabular-nums ${climbRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {climbRate >= 0 ? '+' : ''}{climbRate.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">m/s</span>
                </span>
              </div>
            )}

            {/* Airspeed */}
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400 text-[11px]">Airspeed:</span>
              <span className="text-xs text-slate-200 tabular-nums">
                {airspeed.toFixed(1)} <span className="text-[10px] text-slate-400">m/s</span>
              </span>
            </div>

            {/* Ambient Pressure */}
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400 text-[11px]">Pressure:</span>
              <span className="text-xs text-amber-300 tabular-nums">
                {pressureHpa.toFixed(1)} <span className="text-[10px] text-slate-400">hPa</span>
              </span>
            </div>

            {/* Ambient Temperature */}
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400 text-[11px]">Temp (ISA):</span>
              <span className="text-xs text-slate-300 tabular-nums">
                {ambientTempC.toFixed(1)} <span className="text-[10px] text-slate-400">°C</span>
              </span>
            </div>

            {/* 3D GNSS Coordinates from Launch Pad Origin [0, 0, 0] */}
            <div className="pt-1.5 border-t border-slate-800/90 space-y-0.5">
              <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider flex justify-between">
                <span>GNSS Origin [0,0,0]</span>
                <span className="text-slate-400">3D XYZ (m)</span>
              </div>
              <div className="text-[10px] text-slate-200 tabular-nums flex justify-between">
                <span>X: {Math.round(kernel.position.x)}m</span>
                <span>Y: {Math.round(kernel.position.y)}m</span>
                <span>Z: {Math.round(kernel.position.z)}m</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. COLLAPSIBLE RIGHT ENGINEERING DRAWER (PFD, CHARTS, SANDBOX, JSON) */}
        <EngineeringDrawer
          kernel={kernel}
          telemetry={telemetry}
          isOpen={isDrawerOpen}
          onToggle={() => setIsDrawerOpen(prev => !prev)}
          activeTab={activeDrawerTab}
          onSelectTab={setActiveDrawerTab}
          onExportJson={handleExportJson}
          onUpdate={forceUpdate}
        />

        {/* 5. FLOATING BOTTOM MISSION CONTROL DECK */}
        <div className="absolute bottom-3 left-3 right-16 md:right-20 z-20 pointer-events-auto">
          <FlightControlBar
            kernel={kernel}
            cameraMode={cameraMode}
            setCameraMode={setCameraMode}
            onReset={handleReset}
            onUpdate={forceUpdate}
          />
        </div>
      </div>

      {/* 6. THEORY & LAB MANUAL MODAL DRAWER */}
      <TheoryDrawer
        isOpen={isTheoryOpen}
        onClose={() => setIsTheoryOpen(false)}
      />
    </div>
  );
}

export default App;
