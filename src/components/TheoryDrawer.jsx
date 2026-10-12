import React, { useState } from 'react';
import { BookOpen, X } from 'lucide-react';

export function TheoryDrawer({ isOpen, onClose }) {
  const [activeSection, setActiveSection] = useState('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 left-0 w-full md:w-[620px] bg-slate-950/95 backdrop-blur-xl border-r border-slate-800 z-50 flex flex-col shadow-2xl transition-all">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 font-mono tracking-wide">
              Virtual Labs Theory & Flight Mechanics
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Aeroin SpaceTech "SBRL" (Stratospheric Balloon Rocket Launcher)
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

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-1 px-4 py-2 bg-slate-900/60 border-b border-slate-800 overflow-x-auto text-xs font-mono">
        {[
          { id: 'overview', label: '1. SBRL Architecture' },
          { id: 'envelope', label: '2. 36-40km Stratosphere & ISA' },
          { id: 'aerodynamics', label: '3. Pyramidal Wave Drag' },
          { id: 'experiments', label: '4. Lab Experiments' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeSection === tab.id
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Body */}
      <div className="flex-1 p-5 overflow-y-auto space-y-6 text-xs text-slate-300 font-sans leading-relaxed custom-scrollbar">
        {/* SECTION 1: SBRL ARCHITECTURE */}
        {activeSection === 'overview' && (
          <div className="space-y-4">
            <div className="bg-sky-950/30 border border-sky-500/30 p-3.5 rounded-xl">
              <h3 className="text-sm font-bold text-sky-300 font-mono mb-1">
                Aeroin SpaceTech SBRL Direct-to-Orbit Platform
              </h3>
              <p className="text-slate-300 text-xs">
                The <strong>Stratospheric Balloon Rocket Launcher (SBRL)</strong> developed by <strong>Aeroin SpaceTech</strong> 
                is a proprietary direct-to-orbit launch system designed to achieve extreme stratospheric release ceilings of 
                <strong> 36,000 m to 40,000 m (36–40 km)</strong>.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl space-y-2.5">
              <h4 className="text-xs font-bold text-slate-100 font-mono uppercase tracking-wider text-sky-400">
                Core Innovations & Pyramidal Geometry
              </h4>
              <ul className="list-disc list-inside space-y-2 text-slate-300 pl-1">
                <li>
                  <strong>Faceted Pyramidal Airframe:</strong> Unlike conventional cylindrical rockets, the SBRL launcher employs a faceted pyramidal geometric profile with sharp oblique compression ramps. This sharp leading geometry minimizes wave drag during supersonic acceleration in near-vacuum.
                </li>
                <li>
                  <strong>Tetrahedral Cradle & Forward-Rail Release:</strong> The launch vehicle is suspended inside a lightweight carbon-composite tetrahedral truss. Upon reaching the 36–40 km release window, pneumatic latches disengage, allowing the rocket to execute a forward-rail guided separation clear of the flight train.
                </li>
                <li>
                  <strong>Ultra-High-Altitude Helium Envelope:</strong> Sized for extreme stratospheric ceilings where ambient pressure is <strong>&lt; 3 hPa (0.2%–0.3% of sea level)</strong>, requiring envelope expansion capacities exceeding <strong>850,000 m³</strong>.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* SECTION 2: 36-40 KM STRATOSPHERE & ISA EQUATIONS */}
        {activeSection === 'envelope' && (
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-3 font-mono">
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                1. Stratospheric Warming & Pressure Scalings to 40 km
              </h3>
              <p className="text-slate-300 text-[11px] font-sans">
                Earth's upper stratosphere between 20 km and 47 km exhibits a strong positive temperature lapse rate due to solar UV absorption by ozone:
              </p>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-sky-200">
                <code>T(h) = T₂₀ + L_strat1 · (h - 20000)  [20 - 32 km, L = +0.0010 K/m]</code><br />
                <code>T(h) = T₃₂ + L_strat2 · (h - 32000)  [32 - 47 km, L = +0.0028 K/m]</code><br />
                <code>T(40,000 m) ≈ 251.05 K (-22.1°C), warming toward ~270.65 K at 47 km</code>
              </div>

              <div className="text-[11px] text-slate-300 font-sans">
                <strong>Ambient Release Pressure:</strong> At 36,000 m, pressure plummets to <strong>~4.4 hPa</strong>, and at 40,000 m to <strong>~2.8 hPa</strong>. The launcher operates in a virtual vacuum, with ambient air density ρ ≈ 0.0039 kg/m³ (less than 0.35% of sea level).
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-3 font-mono">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                2. Archimedes Buoyancy in Near-Vacuum
              </h3>
              <p className="text-slate-300 text-[11px] font-sans">
                To float a 2,500 kg total gross stack at 38 km where ρ_air ≈ 0.0048 kg/m³:
              </p>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-emerald-200">
                <code>F_b = (ρ_air - ρ_He) · V_balloon · g</code><br />
                <code>V_balloon(38 km) ≈ (m_He / M_He) · R_gas · T / P ≈ 820,000 m³</code>
              </div>

              <p className="text-slate-300 text-[11px] font-sans">
                The balloon envelope expands by a factor of <strong>&gt;200×</strong> compared to sea level, shifting from a tall slender ribbon into a gargantuan translucent pumpkin membrane over 120 meters in diameter!
              </p>
            </div>
          </div>
        )}

        {/* SECTION 3: PYRAMIDAL WAVE DRAG & VACUUM PLUMES */}
        {activeSection === 'aerodynamics' && (
          <div className="space-y-4">
            <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-xl space-y-2">
              <h3 className="text-xs font-bold text-amber-300 font-mono uppercase tracking-wider">
                Faceted Pyramidal Aerodynamic Wave Drag Advantage
              </h3>
              <p className="text-slate-300 text-xs">
                In supersonic flight, blunt bodies and cylinders generate detached bow shock waves that dissipate massive amounts of kinetic energy. 
                The <strong>Aeroin SBRL faceted pyramidal profile</strong> maintains sharp, planar compression ramps with attached oblique shock waves:
              </p>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-amber-200 text-xs">
                <code>C_d(pyramidal) ≈ 0.19  vs  C_d(cylinder) ≈ 0.35 - 0.45</code><br />
                <code>q_max(36-40 km) &lt; 1,500 Pa  vs  q_max(ground launch) ≈ 35,000 - 45,000 Pa</code>
              </div>
              <p className="text-slate-300 text-xs">
                Combined with a 36–40 km launch altitude, dynamic pressure q = 0.5 · ρ · v² is negligible. The vehicle completely bypasses Max-Q structural load penalties!
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-2">
              <h3 className="text-xs font-bold text-sky-400 font-mono uppercase tracking-wider">
                Near-Vacuum Extreme Plume Under-Expansion
              </h3>
              <p className="text-slate-300 text-xs">
                At 36–40 km (P_ambient ≈ 2.8 - 4.0 hPa), rocket nozzle exhaust expands outward into an extreme under-expanded luminous bell plume (~85° expansion angle). The vacuum specific impulse I_sp reaches peak theoretical efficiency (342 - 360 s).
              </p>
            </div>
          </div>
        )}

        {/* SECTION 4: GUIDED EXPERIMENTS */}
        {activeSection === 'experiments' && (
          <div className="space-y-3.5">
            <div className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider">
              Aeroin SpaceTech SBRL Virtual Labs Experiments:
            </div>

            {/* Experiment 1 */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-100 font-mono">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[10px]">1</span>
                <span>Extreme Stratospheric Ascent to 36–40 km</span>
              </div>
              <p className="text-[11px] text-slate-300">
                <strong>Objective:</strong> Fast-forward through Troposphere and Tropopause to observe the balloon envelope expanding past 800,000 m³ as ambient pressure drops below 4 hPa. Verify the stratopause temperature warming trend on the Temp Inversion chart.
              </p>
            </div>

            {/* Experiment 2 */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-100 font-mono">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">2</span>
                <span>Faceted Pyramidal Airframe & Dynamic Q Verification</span>
              </div>
              <p className="text-[11px] text-slate-300">
                <strong>Objective:</strong> Monitor dynamic pressure $q$ as the SBRL vehicle accelerates through Mach 1 to Mach 3. Confirm that dynamic pressure remains below 1,500 Pa, proving the structural benefits of high-altitude pyramidal launches.
              </p>
            </div>

            {/* Experiment 3 */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-100 font-mono">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[10px]">3</span>
                <span>Sensor Anomaly & Fault Injection at 38 km</span>
              </div>
              <p className="text-[11px] text-slate-300">
                <strong>Objective:</strong> Enable "Barometer Sticking" and "IMU Noise / Gyro Bias Spike" in the Sandbox panel. Observe the divergence in the Fault Comparison chart and verify how the Kalman navigation filter flags degraded status.
              </p>
            </div>

            {/* Experiment 4 */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-100 font-mono">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">4</span>
                <span>Forward-Rail Release & Vacuum Ignition</span>
              </div>
              <p className="text-[11px] text-slate-300">
                <strong>Objective:</strong> Within the 36,000–40,000 m envelope window, execute "Rail Release Latch" followed by "SBRL Stage 1 Ignition". Switch to "Horizon Wide" camera to observe the broad vacuum plume over-expansion and export the conformant JSON telemetry.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
