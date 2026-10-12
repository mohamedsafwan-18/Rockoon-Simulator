import React, { useRef, useEffect, useState } from 'react';
import { Activity, TrendingUp, Thermometer, ShieldAlert } from 'lucide-react';

export function TelemetryGraphs({ kernel }) {
  const [activeTab, setActiveTab] = useState('altitude'); // 'altitude' | 'max_q' | 'temp_inversion' | 'fault_comparison'
  const canvasRef = useRef(null);

  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const renderGraph = () => {
      animId = requestAnimationFrame(renderGraph);
      const width = canvas.width;
      const height = canvas.height;
      const buffer = kernel.telemetryBuffer;

      ctx.clearRect(0, 0, width, height);

      // Background grid
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const xLines = 8;
      const yLines = 5;

      for (let i = 1; i < xLines; i++) {
        const x = (i / xLines) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let j = 1; j < yLines; j++) {
        const y = (j / yLines) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (buffer.length < 2) {
        ctx.fillStyle = '#64748b';
        ctx.font = '11px monospace';
        ctx.fillText('Awaiting mission telemetry samples...', 20, height / 2);
        return;
      }

      // Slice recent data points (e.g. up to 120 points)
      const maxPts = 120;
      const dataSlice = buffer.slice(-maxPts);
      const count = dataSlice.length;

      // ---------------- CHART 1: ALTITUDE VS TIME ----------------
      if (activeTab === 'altitude') {
        const maxAlt = 45000; // 45 km to cover 36-40 km SBRL window
        const paddingBottom = 25;
        const paddingTop = 20;
        const graphHeight = height - paddingBottom - paddingTop;

        // Draw Troposphere (11km) and Tropopause (20km) boundary lines
        const y11k = height - paddingBottom - (11000 / maxAlt) * graphHeight;
        const y20k = height - paddingBottom - (20000 / maxAlt) * graphHeight;
        const y36k = height - paddingBottom - (36000 / maxAlt) * graphHeight;
        const y40k = height - paddingBottom - (40000 / maxAlt) * graphHeight;

        // SBRL Release Corridor Highlight (36-40 km)
        ctx.fillStyle = '#f973161f';
        ctx.fillRect(0, y40k, width, y36k - y40k);

        ctx.strokeStyle = '#f9731688';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y36k); ctx.lineTo(width, y36k);
        ctx.moveTo(0, y40k); ctx.lineTo(width, y40k);
        ctx.stroke();

        ctx.strokeStyle = '#38bdf833';
        ctx.beginPath();
        ctx.moveTo(0, y11k); ctx.lineTo(width, y11k);
        ctx.moveTo(0, y20k); ctx.lineTo(width, y20k);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#38bdf899';
        ctx.font = '9px monospace';
        ctx.fillText('TROPOPAUSE (11 km)', 10, y11k - 4);
        ctx.fillText('STRATOSPHERE (20 km)', 10, y20k - 4);

        ctx.fillStyle = '#fb923c';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('★ SBRL RELEASE ENVELOPE (36 - 40 km)', 10, y36k + 11);

        // Plot Altitude line
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
        ctx.beginPath();

        dataSlice.forEach((pt, idx) => {
          const x = (idx / (count - 1)) * (width - 40) + 10;
          const alt = pt.barometric_sensor?.true_altitude_m || 0;
          const y = height - paddingBottom - Math.min(1.0, alt / maxAlt) * graphHeight;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Current value badge
        const latest = dataSlice[count - 1];
        const latestAlt = latest.barometric_sensor?.true_altitude_m || 0;
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`h: ${Math.round(latestAlt)} m (${(latestAlt / 1000).toFixed(2)} km)`, width - 180, 24);
      }

      // ---------------- CHART 2: DYNAMIC PRESSURE Q VS TIME ----------------
      else if (activeTab === 'max_q') {
        const maxQ = 6000; // 6000 Pa
        const paddingBottom = 25;
        const paddingTop = 25;
        const graphHeight = height - paddingBottom - paddingTop;

        // Ground Launch comparison dashed line (typically 35,000 Pa Max-Q!)
        ctx.fillStyle = '#f43f5e55';
        ctx.fillRect(0, 0, width, 18);
        ctx.fillStyle = '#fca5a5';
        ctx.font = '9px monospace';
        ctx.fillText('GROUND ROCKET MAX-Q ZONE (30,000 - 45,000 Pa) vs AEROIN SBRL PYRAMIDAL (< 1,500 Pa)', 10, 13);

        // Dynamic Q line
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.2;
        ctx.beginPath();

        dataSlice.forEach((pt, idx) => {
          const x = (idx / (count - 1)) * (width - 40) + 10;
          const p = pt.barometric_sensor?.pressure_hpa || 1013;
          const t_c = pt.environmental_sensors?.ambient_temp_c || 15;
          const rho = (p * 100) / (287.05 * (t_c + 273.15));
          const v = pt.navigation_state?.true_airspeed_mps || 0;
          const q = 0.5 * rho * v * v;

          const y = height - paddingBottom - Math.min(1.0, q / maxQ) * graphHeight;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('Dynamic Pressure q [Pa]', width - 180, 36);
      }

      // ---------------- CHART 3: TEMPERATURE INVERSION PROFILE ----------------
      else if (activeTab === 'temp_inversion') {
        const paddingBottom = 25;
        const paddingTop = 20;
        const graphHeight = height - paddingBottom - paddingTop;

        // Temperature range: -70 °C to +30 °C (span 100 °C)
        const minT = -70;
        const maxT = 30;

        // 0°C freezing line
        const yZero = height - paddingBottom - ((0 - minT) / (maxT - minT)) * graphHeight;
        ctx.strokeStyle = '#64748b44';
        ctx.beginPath();
        ctx.moveTo(0, yZero); ctx.lineTo(width, yZero);
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = '9px monospace';
        ctx.fillText('0 °C Freezing Level', 10, yZero - 3);

        // Inversion line
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2.2;
        ctx.beginPath();

        dataSlice.forEach((pt, idx) => {
          const x = (idx / (count - 1)) * (width - 40) + 10;
          const temp = pt.environmental_sensors?.ambient_temp_c || 15;
          const y = height - paddingBottom - Math.max(0, Math.min(1.0, (temp - minT) / (maxT - minT))) * graphHeight;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        const latest = dataSlice[count - 1];
        const latestT = latest.environmental_sensors?.ambient_temp_c || 15;
        ctx.fillStyle = '#fbcfe8';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`T: ${latestT.toFixed(1)} °C (Stratospheric Inversion)`, width - 230, 24);
      }

      // ---------------- CHART 4: TRUE VS FAULT SENSOR COMPARISON ----------------
      else if (activeTab === 'fault_comparison') {
        const maxAlt = 45000; // 45 km to cover 36-40 km window
        const paddingBottom = 25;
        const paddingTop = 20;
        const graphHeight = height - paddingBottom - paddingTop;

        // 1. True Altitude (Green)
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        dataSlice.forEach((pt, idx) => {
          const x = (idx / (count - 1)) * (width - 40) + 10;
          const alt = pt.barometric_sensor?.true_altitude_m || 0;
          const y = height - paddingBottom - Math.min(1.0, alt / maxAlt) * graphHeight;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // 2. Barometric Altitude (Yellow/Red if fault)
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        dataSlice.forEach((pt, idx) => {
          const x = (idx / (count - 1)) * (width - 40) + 10;
          const baroAlt = pt.barometric_sensor?.derived_altitude_m || 0;
          const y = height - paddingBottom - Math.min(1.0, baroAlt / maxAlt) * graphHeight;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // 3. GPS Altitude (Magenta with dropouts)
        ctx.strokeStyle = '#d946ef';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        let penDown = false;
        dataSlice.forEach((pt, idx) => {
          const x = (idx / (count - 1)) * (width - 40) + 10;
          const gpsAlt = pt.navigation_state?.gps_altitude_m;
          if (gpsAlt !== null && gpsAlt !== undefined) {
            const y = height - paddingBottom - Math.min(1.0, gpsAlt / maxAlt) * graphHeight;
            if (!penDown) {
              ctx.moveTo(x, y);
              penDown = true;
            } else {
              ctx.lineTo(x, y);
            }
          } else {
            penDown = false;
          }
        });
        ctx.stroke();

        // Legend
        ctx.font = '9px monospace';
        ctx.fillStyle = '#10b981'; ctx.fillText('● True Alt', 15, 20);
        ctx.fillStyle = '#f59e0b'; ctx.fillText('● Baro Derived Alt', 95, 20);
        ctx.fillStyle = '#d946ef'; ctx.fillText('● GPS Fix (With Dropouts)', 210, 20);
      }
    };

    animId = requestAnimationFrame(renderGraph);
    return () => cancelAnimationFrame(animId);
  }, [kernel, activeTab]);

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
      {/* Strip Chart Tabs */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('altitude')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === 'altitude'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className="w-3 h-3 text-sky-400" />
            <span>Alt vs Time</span>
          </button>

          <button
            onClick={() => setActiveTab('max_q')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === 'max_q'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3 h-3 text-amber-400" />
            <span>Dynamic Q (Max-Q)</span>
          </button>

          <button
            onClick={() => setActiveTab('temp_inversion')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === 'temp_inversion'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Thermometer className="w-3 h-3 text-pink-400" />
            <span>Temp Inversion</span>
          </button>

          <button
            onClick={() => setActiveTab('fault_comparison')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === 'fault_comparison'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            <span>Fault Comparison</span>
          </button>
        </div>

        <span className="text-[10px] font-mono text-slate-400">10 Hz Telemetry Stream</span>
      </div>

      {/* Canvas Area */}
      <div className="relative w-full h-36 bg-slate-950">
        <canvas ref={canvasRef} width={640} height={144} className="w-full h-full block" />
      </div>
    </div>
  );
}
