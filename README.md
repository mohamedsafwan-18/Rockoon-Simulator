# Virtual Labs: Rockoon Simulator and Integrated ground control station 

A browser-based, high-fidelity Virtual Labs (V-Labs) interactive simulation platform modeled for **Rockoon** (Ultra-high-altitude zero-pressure balloon carrying a direct-to-orbit faceted pyramidal launch vehicle with a 36 km to 40 km release envelope).

---

## 🚀 Mission Highlights: 

### 1. Faceted Pyramidal Airframe & Vehicle Geometry
- **Pyramidal Direct-to-Orbit Geometry:** Faceted aerodynamic composite shell with sharp planar compression ramps and a supersonic apex compression needle.
- **Low Supersonic Wave Drag ($C_{d,base} \approx 0.19$):** Attached oblique shock ramps significantly reduce wave drag compared to blunt cylindrical or toroidal bodies.
- **Mission Livery & Textures:** Matte carbon-fiber composite panels with high-contrast mission livery labeled `AEROIN SPACETECH`, `SBRL-01`, and `DIRECT-TO-ORBIT LAUNCH SYSTEM`.
- **Tetrahedral Cradle & Forward-Rail Release:** Aerodynamic carbon-fiber tetrahedral truss linking the zero-pressure flight train directly to pneumatic rail latches with dual forward launch rails.
- **Vacuum Plume VFX:** Broad, translucent, highly under-expanded plume tailored for near-vacuum ignition at 36–40 km (ambient pressure ~0.2% to 0.5% sea level, ~85° expansion cone).

### 2. Extreme Stratospheric Flight Envelope (36 km – 40 km)
- **Target Release Threshold Window:** **36,000 m to 40,000 m** (stratopause boundary).
- **Extended ISA Model (scaled to 40 km+):** Accurately models upper stratospheric temperature warming up to ~251 K at 40 km (warming toward ~270 K at 47 km).
- **Near-Vacuum Release Pressure:** **~2.8 to 4.4 hPa** (< 0.35% sea level).
- **Dynamic Pressure ($q = \frac{1}{2}\rho v^2$):** Less than 1,500 Pa during supersonic acceleration, bypassing Max-Q structural load barriers.
- **Ultra-High-Altitude Balloon Envelope:** Over **880,000 m³** expansion volume to float in near-vacuum.

### 3. Updated Telemetry & JSON Schema
Conforms to the Aeroin SpaceTech mission telemetry specification:

```json
{
  "mission_metadata": {
    "platform_name": "Aeroin SpaceTech SBRL",
    "vehicle_configuration": "Pyramidal Direct-to-Orbit Launch System",
    "launch_type": "Stratospheric Balloon Rocket Launch (36-40 km)",
    "firmware_build": "SBRL-AEROIN-SIM-v2.4",
    "sample_rate_hz": 10,
    "total_samples": 1250,
    "environment_presets": {
      "base_wind_speed_kmh": 45.0,
      "wind_direction_deg": 180,
      "turbulence_level": "mild",
      "humidity_surface_pct": 65
    }
  },
  "sensor_telemetry_records": [...]
}
```

---

## 🛠️ Quick Start

```bash
# Navigate to project directory
cd "C:\Users\Mohamed Safwan\.gemini\antigravity\scratch\rockoon-simulator"

# Run automated verification tests
npm test

# Run linter
npm run lint

# Start interactive local development server
npm run dev
```

---

## 📁 Project Architecture

```
rockoon-simulator/
├── src/
│   ├── physics/
│   │   ├── isaAtmosphere.js      # ISA model extended to 40 km (stratopause warming, < 3 hPa)
│   │   ├── balloonDynamics.js    # Ultra-high-altitude balloon (880k m3 envelope, 36-40 km float)
│   │   ├── rocketDynamics.js     # Aeroin SBRL faceted pyramidal rocket & multi-stage propulsion
│   │   └── simulationKernel.js   # 36-40 km release window, wind shear, fault injection, telemetry
│   ├── graphics/
│   │   ├── cameraModes.js        # Orbit, Ground Tracker, Stratosphere Horizon, Onboard POV
│   │   └── ThreeScene.jsx        # Pyramidal SBRL 3D model, livery texture, tetrahedral cradle, plume
│   ├── components/
│   │   ├── VirtualLabsHeader.jsx    # Aeroin SpaceTech SBRL branding & telemetry status
│   │   ├── PrimaryFlightDisplay.jsx # Artificial horizon, dynamic Q, 36-40 km window indicator
│   │   ├── EnvironmentalSandbox.jsx # Atmospheric sliders & 6 fault injection switches
│   │   ├── TelemetryGraphs.jsx      # Canvas strip charts (45 km scale, 36-40 km highlighted band)
│   │   ├── FlightControlBar.jsx     # Play/pause, time warp, rail release, SBRL Stage 1 ignition
│   │   ├── LiveTelemetryViewer.jsx  # Streaming JSON frame viewer & .json file exporter
│   │   └── TheoryDrawer.jsx         # Aeroin SBRL theory, pyramidal wave drag, 4 guided experiments
│   ├── App.jsx                   # Master dashboard composition and integration loop
│   ├── main.jsx                  # React 19 entry point
│   └── index.css                 # Tailwind CSS v4 dark aerospace HUD styles
├── test_simulation.js            # Automated verification test script
├── package.json
└── vite.config.js
```
