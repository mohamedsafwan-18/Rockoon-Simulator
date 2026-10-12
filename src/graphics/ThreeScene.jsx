// High-Fidelity 3D Digital Twin Visualizer for Aeroin SpaceTech SBRL (Stratospheric Balloon Rocket Launcher)
// Features:
// - Full 3D Spherical Earth with procedural continents, oceans, cloud bands, and atmospheric glow
// - Imaginary 360° Circular LEO Orbit Ring traced around the Earth sphere
// - Real-time 3D flight trajectory line trace from ground pad to circular LEO orbit
// - Satellite / Upper Stage with deployable solar arrays revolving around Earth in circular LEO orbit
// - Multi-layered Yellow Plasma Fire Thrusters (white-yellow core, golden plasma shock diamonds, amber plume)
// - Detailed Spaceport Ground Launch Complex (lightning towers, radar dome, LHe tanks, apron) with zero sensor interference

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CAMERA_MODES } from './cameraModes.js';

const R_EARTH_VIS = 2400; // Visual Earth sphere radius (allows seamless ground pad + full-globe zoom out)
const LEO_TARGET_ALT_M = 212800; // Nominal circular LEO altitude (212.8 km)

/**
 * Convert physical altitude (meters) to 3D visual radial height above Earth sphere surface
 */
function getVisualAltitude(altM) {
  const h = Math.max(0, altM);
  if (h <= 40000) {
    // 0 to 40 km -> 0 to 240 visual units
    return h * 0.006;
  }
  // 40 km to 212.8 km LEO -> 240 to 560 visual units above Earth surface
  return 240 + (h - 40000) * 0.00185;
}

/**
 * Map physical (x, y, z, orbitalAngleRad) to 3D world coordinates around the spherical Earth
 * Earth center is at (0, -R_EARTH_VIS, 0) so launch pad is at top pole (0, 0, 0).
 */
function toSphericalWorldPos(xM, altM, zM, orbitalAngleRad = 0, isLaunched = true) {
  const hVis = isLaunched ? getVisualAltitude(altM) + 1.8 : 1.8;
  const r = R_EARTH_VIS + hVis;
  // Combine local horizontal drift angle + orbital revolution angle around Earth
  const theta = (xM * 0.01) / R_EARTH_VIS + (orbitalAngleRad || 0);
  const wx = r * Math.sin(theta);
  const wy = -R_EARTH_VIS + r * Math.cos(theta);
  const wz = zM * 0.01;
  return { wx, wy, wz, theta, r };
}

/**
 * Procedural high-contrast mission livery texture for the SBRL central cylindrical band
 */
function createSbrlBandTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#141416';
  ctx.fillRect(0, 0, 1024, 512);

  ctx.strokeStyle = '#1e1f24';
  ctx.lineWidth = 1;
  for (let i = 0; i < 1024; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
  }

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 24);
  ctx.lineTo(1024, 24);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 488);
  ctx.lineTo(1024, 488);
  ctx.stroke();

  const drawSbrlLogo = (centerX, centerY) => {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(245, 197, 66, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#f5c542';
    ctx.font = '900 130px "Times New Roman", Georgia, serif';
    ctx.fillText('SBRL', centerX, centerY - 10);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 22px monospace';
    ctx.letterSpacing = '4px';
    ctx.fillText('AEROIN SPACETECH', centerX, centerY + 85);
    ctx.restore();
  };

  drawSbrlLogo(256, 256);
  drawSbrlLogo(768, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Procedural 3D Earth Globe Texture (Oceans, Continents, Ice Caps, Orbital Grid)
 */
function createEarthGlobeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Deep ocean gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
  oceanGrad.addColorStop(0.0, '#0c2340');
  oceanGrad.addColorStop(0.2, '#0a3161');
  oceanGrad.addColorStop(0.5, '#072a54');
  oceanGrad.addColorStop(0.8, '#0a3161');
  oceanGrad.addColorStop(1.0, '#0c2340');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 2048, 1024);

  // Procedural continents & landmasses
  const drawContinent = (cx, cy, rx, ry, color, rot = 0) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.15) {
      const jitter = 0.82 + 0.25 * Math.sin(a * 5 + cx) + 0.15 * Math.cos(a * 3 + cy);
      const px = Math.cos(a) * rx * jitter;
      const py = Math.sin(a) * ry * jitter;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Continental masses + coastal shelves
  const blobs = [
    [450, 320, 180, 140, '#14532d', 0.3],
    [520, 620, 130, 210, '#166534', -0.2],
    [1020, 290, 220, 130, '#15803d', 0.1],
    [1060, 560, 150, 190, '#854d0e', 0.0],
    [1420, 340, 280, 170, '#14532d', -0.15],
    [1660, 700, 120, 95, '#7c2d12', 0.2],
    [820, 190, 90, 65, '#1e3a2f', 0.4],
  ];
  blobs.forEach(([x, y, rx, ry, col, rot]) => {
    drawContinent(x, y, rx * 1.12, ry * 1.12, '#0e4f6e', rot); // Shallow coastal water
    drawContinent(x, y, rx, ry, col, rot);
    drawContinent(x + 15, y - 10, rx * 0.55, ry * 0.55, '#3f6212', rot);
  });

  // Polar ice caps
  ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
  ctx.fillRect(0, 0, 2048, 42);
  ctx.fillRect(0, 982, 2048, 42);

  // Subtle lat/lon graticule lines for Virtual Labs orbital reference
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= 2048; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y <= 1024; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(2048, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function ThreeScene({ kernel, cameraMode = CAMERA_MODES.TRACKING_ORBIT, setCameraMode }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const objectsRef = useRef({});
  const mouseStateRef = useRef({
    isDown: false,
    prevX: 0,
    prevY: 0,
    theta: 0.75,
    phi: 0.32,
    radius: 42,
  });

  // Helper to jump zoom level
  const handleQuickZoom = (targetRadius) => {
    mouseStateRef.current.radius = targetRadius;
    if (targetRadius > 2000) {
      mouseStateRef.current.theta = 0.0;
      mouseStateRef.current.phi = 0.15;
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Renderer setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 80000);
    camera.position.set(0, 8, 42);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 2. Lighting Setup
    const sunLight = new THREE.DirectionalLight(0xfff8ea, 2.6);
    sunLight.position.set(3500, 5000, 2800);
    sunLight.castShadow = true;
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x4b729f, 1.15);
    scene.add(ambientLight);

    const earthAlbedoLight = new THREE.DirectionalLight(0x1e5688, 0.75);
    earthAlbedoLight.position.set(0, -1000, 0);
    scene.add(earthAlbedoLight);

    // 3. Full 360° Deep Space Starfield
    const starCount = 4500;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 28000;
      starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = r * Math.cos(phi) - R_EARTH_VIS;
      starPositions[i + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 22.0,
      transparent: true,
      opacity: 0.25,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 4. Full Spherical Earth Globe (Centered at (0, -R_EARTH_VIS, 0) so Top Pole is (0, 0, 0))
    const earthTexture = createEarthGlobeTexture();
    const earthGeo = new THREE.SphereGeometry(R_EARTH_VIS, 96, 96);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.72,
      metalness: 0.15,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.position.set(0, -R_EARTH_VIS, 0);
    earthMesh.receiveShadow = true;
    scene.add(earthMesh);

    // Translucent 3D Atmospheric Scattering Shell around entire Earth sphere
    const atmoShellGeo = new THREE.SphereGeometry(R_EARTH_VIS * 1.028, 64, 64);
    const atmoShellMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmoShellMesh = new THREE.Mesh(atmoShellGeo, atmoShellMat);
    atmoShellMesh.position.set(0, -R_EARTH_VIS, 0);
    scene.add(atmoShellMesh);

    // 4b. IMAGINARY CIRCULAR LEO ORBIT TRACE AROUND THE ENTIRE EARTH SPHERE
    const leoOrbitGroup = new THREE.Group();
    leoOrbitGroup.position.set(0, -R_EARTH_VIS, 0);
    scene.add(leoOrbitGroup);

    const leoRadiusVis = R_EARTH_VIS + getVisualAltitude(LEO_TARGET_ALT_M) + 1.8;
    const leoSegments = 256;
    const leoRingPts = [];
    for (let i = 0; i <= leoSegments; i++) {
      const a = (i / leoSegments) * Math.PI * 2;
      leoRingPts.push(new THREE.Vector3(leoRadiusVis * Math.sin(a), leoRadiusVis * Math.cos(a), 0));
    }

    // Dashed imaginary LEO target orbit line
    const leoImaginaryGeo = new THREE.BufferGeometry().setFromPoints(leoRingPts);
    const leoImaginaryMat = new THREE.LineDashedMaterial({
      color: 0x22d3ee,
      dashSize: 45,
      gapSize: 28,
      transparent: true,
      opacity: 0.75,
    });
    const imaginaryLeoLine = new THREE.Line(leoImaginaryGeo, leoImaginaryMat);
    imaginaryLeoLine.computeLineDistances();
    leoOrbitGroup.add(imaginaryLeoLine);

    // Subtle secondary glow ring for the imaginary LEO orbit
    const leoHaloGeo = new THREE.RingGeometry(leoRadiusVis - 4, leoRadiusVis + 4, 180);
    const leoHaloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22,
    });
    const leoHaloMesh = new THREE.Mesh(leoHaloGeo, leoHaloMat);
    leoOrbitGroup.add(leoHaloMesh);

    // 4c. UPGRADED SPACEPORT GROUND LAUNCH COMPLEX (Strictly at y <= 0, Zero Sensor Interference)
    const padGroup = new THREE.Group();
    scene.add(padGroup);

    // Coastal Spaceport Terrain Apron (flush at y = -0.45)
    const terrainApronGeo = new THREE.CylinderGeometry(85, 95, 0.5, 48);
    const terrainApronMat = new THREE.MeshStandardMaterial({ color: 0x162436, roughness: 0.92, metalness: 0.08 });
    const terrainApron = new THREE.Mesh(terrainApronGeo, terrainApronMat);
    terrainApron.position.y = -0.65;
    terrainApron.receiveShadow = true;
    padGroup.add(terrainApron);

    // Outer Security & Radar Roadway Ring
    const roadRingGeo = new THREE.RingGeometry(52, 56, 64);
    const roadRingMat = new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide });
    const roadRing = new THREE.Mesh(roadRingGeo, roadRingMat);
    roadRing.rotation.x = -Math.PI / 2;
    roadRing.position.y = -0.38;
    padGroup.add(roadRing);

    // Reinforced Octagonal Concrete Launch Pad Deck
    const padGeo = new THREE.CylinderGeometry(20, 22, 0.8, 8);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x263244, roughness: 0.85, metalness: 0.15 });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.y = -0.42;
    padMesh.receiveShadow = true;
    padGroup.add(padMesh);

    // Concentric Helipad / Rockoon Alignment Markings
    const ringGeo1 = new THREE.RingGeometry(13.5, 14.8, 48);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.rotation.x = -Math.PI / 2;
    ringMesh1.position.y = 0.01;
    padGroup.add(ringMesh1);

    const ringGeo2 = new THREE.RingGeometry(6.5, 7.2, 48);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.rotation.x = -Math.PI / 2;
    ringMesh2.position.y = 0.01;
    padGroup.add(ringMesh2);

    // Launch Pedestal holding the rocket at y = 0
    const pedestalGeo = new THREE.CylinderGeometry(1.5, 2.2, 0.8, 16);
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
    const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestalMesh.position.y = 0.4;
    padGroup.add(pedestalMesh);

    // Primary Umbilical Service Tower
    const towerGeo = new THREE.BoxGeometry(1.1, 22, 1.1);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.35 });
    const towerMesh = new THREE.Mesh(towerGeo, towerMat);
    towerMesh.position.set(-8.5, 11, -3);
    padGroup.add(towerMesh);

    // 4 Corner Lightning Arrestor Towers around the Launch Pad
    const beaconMeshes = [];
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const beaconGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 });
    const mastCoords = [
      [-22, -22],
      [22, -22],
      [-22, 22],
      [22, 22],
    ];
    mastCoords.forEach(([mx, mz]) => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.45, 26, 8), mastMat);
      mast.position.set(mx, 13, mz);
      padGroup.add(mast);

      const b = new THREE.Mesh(beaconGeo, beaconMat);
      b.position.set(mx, 26.2, mz);
      padGroup.add(b);
      beaconMeshes.push(b);
    });

    // Primary tower beacon
    const mainBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    mainBeacon.position.set(-8.5, 22.3, -3);
    padGroup.add(mainBeacon);
    beaconMeshes.push(mainBeacon);

    // Telemetry Radar Dome & Tracking Station (East side of pad)
    const radomeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.1 })
    );
    radomeMesh.position.set(32, 3.2, -18);
    padGroup.add(radomeMesh);

    const radomeBase = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.0, 2.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
    );
    radomeBase.position.set(32, 0.8, -18);
    padGroup.add(radomeBase);

    // Cryogenic Helium Storage Spheres (West side of pad)
    for (let i = 0; i < 2; i++) {
      const tankSphere = new THREE.Mesh(
        new THREE.SphereGeometry(2.8, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.5, roughness: 0.25 })
      );
      tankSphere.position.set(-28, 2.6, 12 + i * 7);
      padGroup.add(tankSphere);
    }

    // Tropospheric Cloud Deck Layer (~2.8 km)
    const cloudGeo1 = new THREE.RingGeometry(45, 950, 64);
    const cloudMat1 = new THREE.MeshStandardMaterial({
      color: 0xecf4fa,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    const cloudDeck = new THREE.Mesh(cloudGeo1, cloudMat1);
    cloudDeck.rotation.x = -Math.PI / 2;
    cloudDeck.position.set(0, getVisualAltitude(2800), 0);
    scene.add(cloudDeck);

    // 4d. Designated Maritime / Airspace Safezone Boundary Ring (35 km radius = 350 visual units)
    const safezoneGroup = new THREE.Group();
    scene.add(safezoneGroup);

    const safezoneRingGeo = new THREE.RingGeometry(346, 350, 72);
    const safezoneMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });
    const safezoneMesh = new THREE.Mesh(safezoneRingGeo, safezoneMat);
    safezoneMesh.rotation.x = -Math.PI / 2;
    safezoneMesh.position.y = 0.2;
    safezoneGroup.add(safezoneMesh);

    const safezoneLineGeo = new THREE.BufferGeometry();
    const safezonePts = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      safezonePts.push(new THREE.Vector3(348 * Math.cos(a), 0.4, 348 * Math.sin(a)));
    }
    safezoneLineGeo.setFromPoints(safezonePts);
    const safezoneLine = new THREE.Line(
      safezoneLineGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })
    );
    safezoneGroup.add(safezoneLine);

    // 5. TRANSLUCENT ZERO-PRESSURE BALLOON WITH VISIBLE VERTICAL GORES
    const balloonGroup = new THREE.Group();
    scene.add(balloonGroup);

    const balloonPoints = [];
    const maxR = 12.0;
    for (let i = 0; i <= 20; i++) {
      const theta = (i / 20) * (Math.PI * 0.5);
      const y = 1.5 + 10.5 * Math.cos(theta);
      const r = maxR * Math.sin(theta);
      balloonPoints.push(new THREE.Vector2(r, y));
    }
    for (let i = 1; i <= 24; i++) {
      const t = i / 24;
      const y = 1.5 - 14.0 * t;
      const r = maxR * Math.cos(t * Math.PI * 0.44) * (1.0 - 0.72 * Math.pow(t, 1.8));
      balloonPoints.push(new THREE.Vector2(Math.max(0.45, r), y));
    }

    const balloonGeo = new THREE.LatheGeometry(balloonPoints, 48);
    const balloonMat = new THREE.MeshPhysicalMaterial({
      color: 0xf5faff,
      roughness: 0.22,
      metalness: 0.05,
      transmission: 0.75,
      thickness: 1.5,
      ior: 1.45,
      clearcoat: 0.4,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const balloonMesh = new THREE.Mesh(balloonGeo, balloonMat);
    balloonMesh.castShadow = true;
    balloonGroup.add(balloonMesh);

    const goreCount = 28;
    const goreGroup = new THREE.Group();
    const gorePoints3D = balloonPoints.map((p) => new THREE.Vector3(p.x * 1.008, p.y, 0));
    const goreGeo = new THREE.BufferGeometry().setFromPoints(gorePoints3D);
    const goreLineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
      linewidth: 1.5,
    });
    for (let i = 0; i < goreCount; i++) {
      const angle = (i / goreCount) * Math.PI * 2;
      const goreLine = new THREE.Line(goreGeo, goreLineMat);
      goreLine.rotation.y = angle;
      goreGroup.add(goreLine);
    }
    balloonGroup.add(goreGroup);

    const appendixPoints = [
      new THREE.Vector2(0.45, -12.5),
      new THREE.Vector2(0.35, -13.5),
      new THREE.Vector2(0.2, -15.0),
      new THREE.Vector2(0.08, -16.2),
      new THREE.Vector2(0.02, -17.0),
    ];
    const appendixGeo = new THREE.LatheGeometry(appendixPoints, 16);
    const appendixMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.7,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const appendixMesh = new THREE.Mesh(appendixGeo, appendixMat);
    balloonGroup.add(appendixMesh);

    // 6. SUSPENSION BRIDLE CABLES
    const suspensionGroup = new THREE.Group();
    scene.add(suspensionGroup);

    const cableMat = new THREE.LineBasicMaterial({ color: 0xcfd8dc, linewidth: 2.2 });
    const cableLines = [];
    for (let i = 0; i < 4; i++) {
      const cGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -15, 0),
      ]);
      const cLine = new THREE.Line(cGeo, cableMat);
      suspensionGroup.add(cLine);
      cableLines.push(cLine);
    }

    // 7. AEROIN SPACETECH SBRL LAUNCHER + LEO SATELLITE MODEL
    const rocketGroup = new THREE.Group();
    scene.add(rocketGroup);

    const goldHighlightLight = new THREE.PointLight(0xfff6d6, 1.6, 60);
    goldHighlightLight.position.set(4, 8, 8);
    rocketGroup.add(goldHighlightLight);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf5c026,
      metalness: 0.92,
      roughness: 0.16,
      envMapIntensity: 1.5,
    });

    const sbrlBandTexture = createSbrlBandTexture();
    const bandMat = new THREE.MeshStandardMaterial({
      map: sbrlBandTexture,
      roughness: 0.45,
      metalness: 0.25,
    });

    // A. Golden Conical / Parabolic Dome Nose Cone
    const domeCurvePoints = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const radius = 1.25 * Math.sin(t * Math.PI * 0.5);
      const y = (1.0 - t) * 2.2;
      domeCurvePoints.push(new THREE.Vector2(radius, y));
    }
    const domeGeo = new THREE.LatheGeometry(domeCurvePoints, 48);
    const domeMesh = new THREE.Mesh(domeGeo, goldMat);
    domeMesh.position.y = 0.65;
    domeMesh.castShadow = true;
    rocketGroup.add(domeMesh);

    const tipGeo = new THREE.ConeGeometry(0.08, 0.4, 16);
    const tipMesh = new THREE.Mesh(tipGeo, goldMat);
    tipMesh.position.y = 2.95;
    rocketGroup.add(tipMesh);

    // B. Central Black Cylindrical Band with Bold Golden "SBRL" Typography
    const bandGeo = new THREE.CylinderGeometry(1.26, 1.26, 1.35, 48);
    const bandMesh = new THREE.Mesh(bandGeo, bandMat);
    bandMesh.position.y = 0.0;
    bandMesh.castShadow = true;
    rocketGroup.add(bandMesh);

    // Stage 2 Vacuum Nozzle (exposed when Stage 1 jettisons)
    const stage2Nozzle = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.9, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.2, side: THREE.DoubleSide })
    );
    stage2Nozzle.position.y = -0.95;
    rocketGroup.add(stage2Nozzle);

    // Deployable LEO Satellite Solar Array Wings (Visible when in LEO_ORBIT)
    const solarWingsGroup = new THREE.Group();
    solarWingsGroup.visible = false;
    rocketGroup.add(solarWingsGroup);

    const solarPanelMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.35,
      metalness: 0.8,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.08, 1.1), solarPanelMat);
    wingLeft.position.set(-4.0, 0.1, 0);
    solarWingsGroup.add(wingLeft);

    const wingRight = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.08, 1.1), solarPanelMat);
    wingRight.position.set(4.0, 0.1, 0);
    solarWingsGroup.add(wingRight);

    // Glowing Orbital Satellite Beacon Halo (makes satellite clearly visible when zoomed out to Full Earth)
    const satBeaconMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
      })
    );
    rocketGroup.add(satBeaconMesh);

    // Side suspension harness lugs
    const lugMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const lugGeo = new THREE.BoxGeometry(0.18, 0.25, 0.18);
    const lugLeft = new THREE.Mesh(lugGeo, lugMat);
    lugLeft.position.set(-1.32, 0.45, 0);
    rocketGroup.add(lugLeft);

    const lugRight = new THREE.Mesh(lugGeo, lugMat);
    lugRight.position.set(1.32, 0.45, 0);
    rocketGroup.add(lugRight);

    // C. Lower Clustered Golden Stage 1 Bodies & 4 Exhaust Nozzles
    const clusterGroup = new THREE.Group();
    clusterGroup.position.y = -0.68;
    rocketGroup.add(clusterGroup);

    const coreGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.05, 32);
    const coreMesh = new THREE.Mesh(coreGeo, goldMat);
    coreMesh.position.y = -0.52;
    coreMesh.castShadow = true;
    clusterGroup.add(coreMesh);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = 0.62 * Math.cos(angle);
      const cz = 0.62 * Math.sin(angle);

      const tankGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.05, 24);
      const tank = new THREE.Mesh(tankGeo, goldMat);
      tank.position.set(cx, -0.52, cz);
      tank.castShadow = true;
      clusterGroup.add(tank);

      const nozzGeo = new THREE.ConeGeometry(0.24, 0.55, 24, 1, true);
      const nozzle = new THREE.Mesh(nozzGeo, goldMat);
      nozzle.position.set(cx, -1.25, cz);
      clusterGroup.add(nozzle);
    }

    // 7d. RCS COLD-GAS ATTITUDE & ULLAGE THRUSTER PUFFS (Active during balloon-to-rocket drop-clear & ullage settling)
    const rcsThrusterGroup = new THREE.Group();
    rcsThrusterGroup.visible = false;
    rocketGroup.add(rcsThrusterGroup);

    const rcsJetMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      // Lateral attitude control cold-gas jets on upper collar
      const rcsCone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.35, 12, 1, true), rcsJetMat);
      rcsCone.position.set(Math.cos(a) * 1.85, 0.55, Math.sin(a) * 1.85);
      rcsCone.rotation.z = a === 0 ? Math.PI / 2 : a === Math.PI ? -Math.PI / 2 : 0;
      if (i === 1) rcsCone.rotation.x = -Math.PI / 2;
      if (i === 3) rcsCone.rotation.x = Math.PI / 2;
      rcsThrusterGroup.add(rcsCone);

      // Downward ullage settling thrusters
      const ullageCone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.6, 12, 1, true), rcsJetMat);
      ullageCone.rotation.x = Math.PI;
      ullageCone.position.set(Math.cos(a) * 1.15, -1.6, Math.sin(a) * 1.15);
      rcsThrusterGroup.add(ullageCone);
    }

    // 8. YELLOW PLASMA FIRE THRUSTER SYSTEM (Volumetric Cones + Shock Diamonds + Fire PointLight)
    const plasmaThrusterGroup = new THREE.Group();
    plasmaThrusterGroup.visible = false;
    rocketGroup.add(plasmaThrusterGroup);

    // Dynamic Yellow-Gold Firelight casting glow on rocket airframe
    const thrusterFireLight = new THREE.PointLight(0xffd000, 6.0, 95);
    thrusterFireLight.position.set(0, -3.5, 0);
    plasmaThrusterGroup.add(thrusterFireLight);

    // Materials for multi-layered Yellow Plasma Fire
    const coreWhiteYellowMat = new THREE.MeshBasicMaterial({
      color: 0xfef9c3, // Blinding white-yellow plasma core
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const midYellowPlasmaMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15, // Brilliant golden-yellow plasma fire
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const outerAmberPlasmaMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // Fiery amber-orange plasma expansion sheath
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // 4 individual nozzle plasma jets + 1 giant coalesced yellow plasma plume
    const individualNozzleFlames = [];
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = 0.62 * Math.cos(angle);
      const cz = 0.62 * Math.sin(angle);

      const jetCone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 3.8, 16, 1, true), coreWhiteYellowMat);
      jetCone.rotation.x = Math.PI; // Point downward
      jetCone.position.set(cx, -3.6, cz);
      plasmaThrusterGroup.add(jetCone);
      individualNozzleFlames.push(jetCone);
    }

    // Central Coalesced Yellow Plasma Fire Plume (Core + Mid + Outer Vacuum Bell)
    const mainPlasmaCore = new THREE.Mesh(new THREE.ConeGeometry(0.75, 9.5, 24, 1, true), coreWhiteYellowMat);
    mainPlasmaCore.rotation.x = Math.PI;
    mainPlasmaCore.position.y = -6.0;
    plasmaThrusterGroup.add(mainPlasmaCore);

    const mainPlasmaMid = new THREE.Mesh(new THREE.ConeGeometry(1.65, 16.0, 24, 1, true), midYellowPlasmaMat);
    mainPlasmaMid.rotation.x = Math.PI;
    mainPlasmaMid.position.y = -9.2;
    plasmaThrusterGroup.add(mainPlasmaMid);

    const mainPlasmaOuter = new THREE.Mesh(new THREE.ConeGeometry(3.2, 24.0, 24, 1, true), outerAmberPlasmaMat);
    mainPlasmaOuter.rotation.x = Math.PI;
    mainPlasmaOuter.position.y = -13.0;
    plasmaThrusterGroup.add(mainPlasmaOuter);

    // Glowing Yellow Plasma Mach Shock Diamonds
    const shockDiamonds = [];
    for (let d = 0; d < 4; d++) {
      const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.48 - d * 0.07, 1), coreWhiteYellowMat);
      diamond.scale.set(1.0, 1.8, 1.0);
      diamond.position.y = -3.2 - d * 2.4;
      plasmaThrusterGroup.add(diamond);
      shockDiamonds.push(diamond);
    }

    // 8b. YELLOW PLASMA EXHAUST PARTICLES
    const plumeParticleCount = 360;
    const plumeGeo = new THREE.BufferGeometry();
    const plumePositions = new Float32Array(plumeParticleCount * 3);
    const plumeColors = new Float32Array(plumeParticleCount * 3);
    const plumeSizes = new Float32Array(plumeParticleCount);

    for (let i = 0; i < plumeParticleCount; i++) {
      plumePositions[i * 3] = 0;
      plumePositions[i * 3 + 1] = -10000;
      plumePositions[i * 3 + 2] = 0;

      // Yellow plasma thermal gradient: white-yellow -> golden yellow -> fiery amber
      const t = i / plumeParticleCount;
      plumeColors[i * 3] = 1.0; // R: 1.0
      plumeColors[i * 3 + 1] = Math.max(0.42, 0.98 - t * 0.52); // G: 0.98 -> 0.46
      plumeColors[i * 3 + 2] = Math.max(0.05, 0.75 - t * 0.7); // B: 0.75 -> 0.05

      plumeSizes[i] = 16.0;
    }

    plumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePositions, 3));
    plumeGeo.setAttribute('color', new THREE.BufferAttribute(plumeColors, 3));
    plumeGeo.setAttribute('size', new THREE.BufferAttribute(plumeSizes, 1));

    const plumeMat = new THREE.PointsMaterial({
      size: 16,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const plumePoints = new THREE.Points(plumeGeo, plumeMat);
    scene.add(plumePoints);

    // 8c. Real-Time 3D Historical Flight Trajectory Line Trace
    const maxTrajPoints = 3500;
    const trajPositions = new Float32Array(maxTrajPoints * 3);
    const trajGeo = new THREE.BufferGeometry();
    trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPositions, 3));
    trajGeo.setDrawRange(0, 0);

    const trajMat = new THREE.LineBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.95,
      linewidth: 2.5,
    });
    const trajectoryLine = new THREE.Line(trajGeo, trajMat);
    scene.add(trajectoryLine);

    // Save references
    objectsRef.current = {
      balloonGroup,
      balloonMesh,
      suspensionGroup,
      cableLines,
      rocketGroup,
      clusterGroup,
      solarWingsGroup,
      satBeaconMesh,
      rcsThrusterGroup,
      plasmaThrusterGroup,
      individualNozzleFlames,
      mainPlasmaCore,
      mainPlasmaMid,
      mainPlasmaOuter,
      shockDiamonds,
      thrusterFireLight,
      padGroup,
      beaconMeshes,
      safezoneGroup,
      safezoneMesh,
      trajectoryLine,
      imaginaryLeoLine,
      plumePoints,
      plumePositions,
      starMat,
      sunLight,
      earthMesh,
      cloudDeck,
    };

    // 9. Mouse Orbit Controls (with Extended Full-Earth Zoom Range up to 14,000 units)
    const onMouseDown = (e) => {
      mouseStateRef.current.isDown = true;
      mouseStateRef.current.prevX = e.clientX;
      mouseStateRef.current.prevY = e.clientY;
    };

    const onMouseMove = (e) => {
      if (!mouseStateRef.current.isDown) return;
      const dx = e.clientX - mouseStateRef.current.prevX;
      const dy = e.clientY - mouseStateRef.current.prevY;
      mouseStateRef.current.prevX = e.clientX;
      mouseStateRef.current.prevY = e.clientY;

      mouseStateRef.current.theta -= dx * 0.007;
      mouseStateRef.current.phi = Math.max(-Math.PI / 2 + 0.08, Math.min(Math.PI / 2 - 0.04, mouseStateRef.current.phi + dy * 0.007));
    };

    const onMouseUp = () => {
      mouseStateRef.current.isDown = false;
    };

    const onWheel = (e) => {
      const currentR = mouseStateRef.current.radius;
      // Proportional zoom speed so zooming feels fast & natural both near rocket (r=30) and viewing whole Earth (r=8000)
      const step = e.deltaY * Math.max(0.08, currentR * 0.0016);
      mouseStateRef.current.radius = Math.max(6, Math.min(14000, currentR + step));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: true });

    const onResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        container.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  // Continuous Animation Loop using requestAnimationFrame
  useEffect(() => {
    let animId;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (!kernel || !rendererRef.current || !sceneRef.current || !cameraRef.current) return;

      const obj = objectsRef.current;
      const altitude = kernel.position.y;
      const rocketStatus = kernel.rocket.status;
      const isAttached = kernel.isTetherAttached;
      const hasLaunched = kernel.hasLaunched;
      const isZoomedOutGlobe = cameraMode === CAMERA_MODES.EARTH_GLOBE || mouseStateRef.current.radius > 900;

      // 1. UPDATE ATMOSPHERIC SKY BACKGROUND
      let skyR, skyG, skyB;
      if (isZoomedOutGlobe || altitude >= 28000) {
        skyR = 0.006;
        skyG = 0.008;
        skyB = 0.022;
      } else if (altitude < 11000) {
        const t = altitude / 11000;
        skyR = 0.22 - 0.15 * t;
        skyG = 0.53 - 0.35 * t;
        skyB = 0.92 - 0.5 * t;
      } else {
        const t = (altitude - 11000) / 17000;
        skyR = 0.07 * (1 - t);
        skyG = 0.18 * (1 - t);
        skyB = 0.42 * (1 - t);
      }
      rendererRef.current.setClearColor(new THREE.Color(skyR, skyG, skyB), 1.0);

      // Starfield opacity
      if (obj.starMat) {
        const starOpacity = isZoomedOutGlobe
          ? 0.95
          : Math.min(0.95, Math.max(0.08, (altitude - 8000) / 20000));
        obj.starMat.opacity = starOpacity;
      }

      // Flash launch pad tower beacons
      if (obj.beaconMeshes) {
        const tSec = performance.now() / 1000;
        const on = Math.sin(tSec * 4) > 0;
        obj.beaconMeshes.forEach((b) => {
          b.visible = on;
        });
      }

      // Modulate cloud opacity with Sandbox Relative Humidity
      if (obj.cloudDeck && kernel.env) {
        obj.cloudDeck.material.opacity = 0.08 + (kernel.env.surfaceHumidityPct / 100) * 0.35;
      }

      // 2. COMPUTE SPHERICAL WORLD POSITION AROUND EARTH
      const worldPos = toSphericalWorldPos(
        kernel.position.x,
        altitude,
        kernel.position.z,
        kernel.orbitalAngleRad,
        hasLaunched
      );

      // 2b. UPDATE SAFEZONE PERIMETER VISUAL
      if (obj.safezoneMesh) {
        if (!kernel.isInsideSafezone && kernel.hasLaunched) {
          const tSec = performance.now() / 1000;
          const blink = Math.sin(tSec * 6) > 0;
          obj.safezoneMesh.material.color.setHex(blink ? 0xef4444 : 0x991b1b);
          obj.safezoneMesh.material.opacity = 0.85;
        } else {
          obj.safezoneMesh.material.color.setHex(0x10b981);
          obj.safezoneMesh.material.opacity = 0.5;
        }
      }

      // 2c. UPDATE 3D TRAJECTORY LINE TRACE AROUND SPHERICAL EARTH
      if (obj.trajectoryLine && kernel.trajectoryPoints) {
        const pts = kernel.trajectoryPoints;
        const count = Math.min(pts.length, 3500);
        const posAttr = obj.trajectoryLine.geometry.attributes.position;
        const arr = posAttr.array;

        for (let i = 0; i < count; i++) {
          const pt = pts[i];
          const wp = toSphericalWorldPos(pt.x, pt.y, pt.z, pt.orbitalAngleRad || 0, true);
          arr[i * 3] = wp.wx;
          arr[i * 3 + 1] = wp.wy;
          arr[i * 3 + 2] = wp.wz;
        }
        posAttr.needsUpdate = true;
        obj.trajectoryLine.geometry.setDrawRange(0, count);

        if (rocketStatus === 'LEO_ORBIT') {
          obj.trajectoryLine.material.color.setHex(0xfacc15); // Brilliant golden LEO circular trace
        } else if (rocketStatus === 'ORBIT_INSERTION_FAILURE') {
          obj.trajectoryLine.material.color.setHex(0xf97316); // Orange suborbital decay trace
        } else if (kernel.isBalloonBurst || !kernel.isInsideSafezone) {
          obj.trajectoryLine.material.color.setHex(0xf43f5e);
        } else {
          obj.trajectoryLine.material.color.setHex(0x38bdf8);
        }
      }

      // 2d. POSITION ROCKET / SATELLITE MODEL & STAGING
      if (obj.rocketGroup) {
        obj.rocketGroup.position.set(worldPos.wx, worldPos.wy, worldPos.wz);

        // Scale compensation when zoomed far out to Full Earth view so satellite & plume remain clearly visible
        const camDist = cameraRef.current.position.distanceTo(obj.rocketGroup.position);
        const distScale = camDist > 160 ? Math.min(48.0, 1.0 + (camDist - 160) * 0.0055) : 1.0;
        obj.rocketGroup.scale.set(distScale, distScale, distScale);

        // Stage 1 booster separation
        if (obj.clusterGroup) {
          obj.clusterGroup.visible = !kernel.rocket.isStage1Jettisoned;
        }

        // Deploy Solar Array Wings & Satellite Beacon when in Circular LEO Orbit
        if (obj.solarWingsGroup) {
          obj.solarWingsGroup.visible = rocketStatus === 'LEO_ORBIT';
        }
        if (obj.satBeaconMesh) {
          if (rocketStatus === 'LEO_ORBIT') {
            const pulse = 0.35 + 0.35 * Math.sin(performance.now() * 0.008);
            obj.satBeaconMesh.material.opacity = pulse;
          } else {
            obj.satBeaconMesh.material.opacity = 0.0;
          }
        }

        // RCS Cold-Gas Attitude & Ullage Thrusters during Balloon-to-Rocket Drop-Clear / Ullage Settling
        if (obj.rcsThrusterGroup) {
          obj.rcsThrusterGroup.visible = Boolean(kernel.rocket.isRcsFiring);
          if (kernel.rocket.isRcsFiring) {
            const rcsPulse = 0.8 + 0.35 * Math.sin(performance.now() * 0.15);
            obj.rcsThrusterGroup.scale.set(1.0, rcsPulse, 1.0);
          }
        }

        const pitchRad = ((kernel.rocket.attitudeRpyDeg.pitch - 90) * Math.PI) / 180;
        const rollRad = (kernel.rocket.attitudeRpyDeg.roll * Math.PI) / 180;
        const yawRad = (kernel.rocket.attitudeRpyDeg.yaw * Math.PI) / 180;

        if ((kernel.isBalloonBurst || (!isAttached && rocketStatus === 'RAIL_RELEASE')) && kernel.velocity.vy < -4.0) {
          obj.rocketGroup.rotation.set(Math.PI, yawRad, 0);
        } else if (rocketStatus === 'LEO_ORBIT' || !isAttached) {
          // Align tangent to spherical Earth orbit as satellite revolves around the globe
          obj.rocketGroup.rotation.set(0, 0, -worldPos.theta - Math.PI / 2 + pitchRad);
        } else {
          obj.rocketGroup.rotation.set(pitchRad, yawRad, rollRad);
        }
      }

      // 3. DYNAMIC ZERO-PRESSURE BALLOON EXPANSION & POSITION
      if (obj.balloonGroup) {
        if (kernel.isBalloonBurst) {
          obj.balloonGroup.visible = false;
          if (obj.suspensionGroup) obj.suspensionGroup.visible = false;
        } else if (isAttached) {
          const tetherLengthVisual = 13.5;
          const balloonPosY = worldPos.wy + tetherLengthVisual + 12;
          obj.balloonGroup.position.set(worldPos.wx, balloonPosY, worldPos.wz);
          obj.balloonGroup.visible = true;

          const inflationFactor = Math.min(1.0, altitude / 38000);
          const currentScaleXZ = 0.42 + 2.35 * Math.pow(inflationFactor, 0.55);
          const currentScaleY = 1.75 - 0.4 * inflationFactor;

          obj.balloonGroup.scale.set(currentScaleXZ, currentScaleY, currentScaleXZ);

          if (obj.cableLines && obj.rocketGroup) {
            obj.suspensionGroup.visible = true;
            const rPos = obj.rocketGroup.position;
            const cableAttachBalloonY = balloonPosY + -5.2 * currentScaleY;
            const cableAttachRadius = 7.2 * currentScaleXZ;

            const attachPoints = [
              new THREE.Vector3(rPos.x - 1.32, rPos.y + 0.45, rPos.z),
              new THREE.Vector3(rPos.x + 1.32, rPos.y + 0.45, rPos.z),
              new THREE.Vector3(rPos.x, rPos.y + 0.45, rPos.z - 1.32),
              new THREE.Vector3(rPos.x, rPos.y + 0.45, rPos.z + 1.32),
            ];

            obj.cableLines.forEach((cable, idx) => {
              const angle = (idx / 4) * Math.PI * 2;
              const pTop = new THREE.Vector3(
                obj.balloonGroup.position.x + cableAttachRadius * Math.cos(angle),
                cableAttachBalloonY,
                obj.balloonGroup.position.z + cableAttachRadius * Math.sin(angle)
              );
              cable.geometry.setFromPoints([pTop, attachPoints[idx]]);
            });
          }
        } else {
          // Realistic separation: balloon rebounds upward as rocket drops clear
          const clearanceOffset = Math.min(450, (kernel.rocket.separationClearanceM || 0) * 0.45);
          obj.balloonGroup.position.y += 0.22 + (clearanceOffset < 25 ? 0.15 : 0);
          if (obj.suspensionGroup) obj.suspensionGroup.visible = false;
        }
      }

      // 4. YELLOW PLASMA FIRE THRUSTERS (Volumetric Cones + Shock Diamonds + Particle Wake)
      // Main plasma fire ignites after the 1.5s Pyro Drop-Clear & RCS Ullage Settling transition!
      const isBurning = (rocketStatus === 'STAGE1_BURN' || rocketStatus === 'STAGE2_BURN') && kernel.rocket.thrustN > 5000;
      if (obj.plasmaThrusterGroup) {
        obj.plasmaThrusterGroup.visible = isBurning;
        if (isBurning) {
          const tNow = performance.now();
          const flicker = 0.92 + 0.16 * Math.sin(tNow * 0.08) + 0.08 * Math.cos(tNow * 0.19);
          const isStage1 = rocketStatus === 'STAGE1_BURN';

          // Show 4 outer nozzle jets during Stage 1, or single central vacuum nozzle during Stage 2
          obj.individualNozzleFlames.forEach((jet) => {
            jet.visible = isStage1;
            jet.scale.set(1.0, flicker, 1.0);
          });

          const vacExpansion = isStage1 ? 1.0 : 1.45;
          obj.mainPlasmaCore.scale.set(vacExpansion, flicker, vacExpansion);
          obj.mainPlasmaMid.scale.set(vacExpansion * 1.15, flicker * 1.08, vacExpansion * 1.15);
          obj.mainPlasmaOuter.scale.set(vacExpansion * 1.3, flicker * 1.12, vacExpansion * 1.3);

          obj.shockDiamonds.forEach((d, idx) => {
            d.scale.set(1.0, 1.6 * flicker, 1.0);
            d.position.y = -3.0 - idx * 2.3 * flicker;
          });

          if (obj.thrusterFireLight) {
            obj.thrusterFireLight.intensity = 5.5 * flicker;
          }
        }
      }

      if (obj.plumePositions && obj.rocketGroup) {
        const positions = obj.plumePositions;
        const count = positions.length / 3;
        const rPos = obj.rocketGroup.position;
        const rRot = obj.rocketGroup.rotation;
        const rScale = obj.rocketGroup.scale.x;

        if (isBurning) {
          const vacSpread = Math.min(3.2, 0.7 + (altitude / 36000) * 2.2);

          for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const age = i / count;
            const distDown = (age * 18.0 + Math.random() * 2.5) * rScale;
            const spreadRad = age * vacSpread * (Math.random() * 0.8 + 0.5) * rScale;
            const spreadAngle = Math.random() * Math.PI * 2;

            const lx = spreadRad * Math.cos(spreadAngle);
            const ly = -2.0 * rScale - distDown;
            const lz = spreadRad * Math.sin(spreadAngle);

            const vLocal = new THREE.Vector3(lx, ly, lz);
            vLocal.applyEuler(rRot);

            positions[idx] = rPos.x + vLocal.x;
            positions[idx + 1] = rPos.y + vLocal.y;
            positions[idx + 2] = rPos.z + vLocal.z;
          }
          obj.plumePoints.visible = true;
          obj.plumePoints.geometry.attributes.position.needsUpdate = true;
        } else {
          obj.plumePoints.visible = false;
        }
      }

      // 5. CAMERA MODES & FULL-EARTH ORBIT VIEW
      const camera = cameraRef.current;
      const targetPos = obj.rocketGroup.position;

      if (cameraMode === CAMERA_MODES.EARTH_GLOBE) {
        // Full Earth Sphere & Circular LEO Orbit View
        const { theta, phi, radius } = mouseStateRef.current;
        const globeRadius = Math.max(4800, radius < 1000 ? 7400 : radius);
        const earthCenter = new THREE.Vector3(0, -R_EARTH_VIS, 0);

        const camX = earthCenter.x + globeRadius * Math.cos(phi) * Math.sin(theta);
        const camY = earthCenter.y + globeRadius * Math.sin(phi);
        const camZ = earthCenter.z + globeRadius * Math.cos(phi) * Math.cos(theta);

        camera.fov = 48;
        camera.updateProjectionMatrix();
        camera.position.set(camX, camY, camZ);
        camera.lookAt(earthCenter.x, earthCenter.y, earthCenter.z);
      } else if (cameraMode === CAMERA_MODES.TRACKING_ORBIT) {
        const { theta, phi, radius } = mouseStateRef.current;
        // If user zoomed way out with scroll wheel (> 2200), center camera on Earth Sphere so full globe & LEO ring are framed!
        const lookCenter = radius > 2200 ? new THREE.Vector3(0, -R_EARTH_VIS, 0) : targetPos;

        const camX = lookCenter.x + radius * Math.cos(phi) * Math.sin(theta);
        const camY = lookCenter.y + radius * Math.sin(phi);
        const camZ = lookCenter.z + radius * Math.cos(phi) * Math.cos(theta);

        camera.fov = 50;
        camera.updateProjectionMatrix();
        camera.position.set(camX, camY, camZ);
        camera.lookAt(lookCenter.x, lookCenter.y, lookCenter.z);
      } else if (cameraMode === CAMERA_MODES.GROUND_TRACKER) {
        camera.position.set(0, 4, 85);
        camera.lookAt(targetPos.x, targetPos.y, targetPos.z);
        camera.fov = Math.max(1.5, 45 - (altitude / 1000) * 1.1);
        camera.updateProjectionMatrix();
      } else if (cameraMode === CAMERA_MODES.HORIZON_WIDE) {
        camera.position.set(targetPos.x + 80, targetPos.y + 14, targetPos.z + 95);
        camera.lookAt(targetPos.x, targetPos.y - 8, targetPos.z);
        camera.fov = 68;
        camera.updateProjectionMatrix();
      } else if (cameraMode === CAMERA_MODES.ONBOARD_POV) {
        camera.position.set(targetPos.x, targetPos.y - 1.5, targetPos.z);
        camera.lookAt(0, -R_EARTH_VIS, 0);
        camera.fov = 85;
        camera.updateProjectionMatrix();
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [kernel, cameraMode]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Quick Zoom & Full Earth / LEO Orbit View Controls */}
      <div className=" absolute bottom-16 right-3 z-20 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-xl text-[11px] font-mono">
        <button
          onClick={() => {
            if (setCameraMode) setCameraMode(CAMERA_MODES.TRACKING_ORBIT);
            handleQuickZoom(40);
          }}
          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-sky-500/20 text-sky-300 border border-slate-700 hover:border-sky-500/40 transition-all"
          title="Zoom in close to the SBRL Vehicle"
        >
          🔍 Vehicle View
        </button>
        <button
          onClick={() => {
            if (setCameraMode) setCameraMode(CAMERA_MODES.EARTH_GLOBE);
            handleQuickZoom(7400);
          }}
          className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-400/50 font-bold transition-all"
          title="Zoom out to view the entire Earth Sphere & Imaginary Circular LEO Orbit"
        >
          🌍 Full Earth & LEO Orbit
        </button>
        <button
          onClick={() => {
            mouseStateRef.current.radius = Math.max(8, mouseStateRef.current.radius * 0.65);
          }}
          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          title="Zoom In"
        >
          ＋
        </button>
        <button
          onClick={() => {
            mouseStateRef.current.radius = Math.min(14000, mouseStateRef.current.radius * 1.5);
          }}
          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          title="Zoom Out (See Entire Earth & LEO Orbit)"
        >
          －
        </button>
      </div>

      {/* Optical Reticle Overlay for Ground Optical Tracker */}
      {cameraMode === CAMERA_MODES.GROUND_TRACKER && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-72 h-72 border border-sky-500/40 rounded-full flex items-center justify-center">
            <div className="absolute w-full h-px bg-sky-500/30" />
            <div className="absolute h-full w-px bg-sky-500/30" />
            <div className="w-4 h-4 border border-sky-400 rounded-full animate-ping" />
            <div className="absolute bottom-3 left-4 text-[10px] font-mono text-sky-400 tracking-wider">
              AEROIN SBRL OPTICAL TRACKER [AZ: {Math.round(kernel.rocket.attitudeRpyDeg.yaw)}° | EL:{' '}
              {Math.max(0, Math.min(90, Math.round((Math.atan2(kernel.position.y, 85) * 180) / Math.PI)))}°]
            </div>
            <div className="absolute top-3 right-4 text-[9px] font-mono text-amber-400">
              TARGET: 36 - 40 km CEILING
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
