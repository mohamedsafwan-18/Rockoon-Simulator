// High-Fidelity 3D Digital Twin Visualizer for Aeroin SpaceTech SBRL (Stratospheric Balloon Rocket Launcher)
// Accurately modeled after Aeroin SBRL reference:
// - Translucent zero-pressure balloon with vertical ribbed gores
// - Suspension cables descending from balloon collar directly to gondola
// - Golden metallic conical dome nose cone
// - Dark matte band with bold golden "SBRL" mission typography
// - Clustered golden cylindrical booster stages with 4 golden exhaust nozzles
// - Launch pad environment on ground with smooth traversal from 0 m to 40 km stratosphere!

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CAMERA_MODES } from './cameraModes.js';

/**
 * Procedural high-contrast mission livery texture for the SBRL central cylindrical band
 * Matches the reference image: Dark matte band with bold golden "SBRL" text!
 */
function createSbrlBandTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Matte deep charcoal / black base
  ctx.fillStyle = '#141416';
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle carbon composite texture
  ctx.strokeStyle = '#1e1f24';
  ctx.lineWidth = 1;
  for (let i = 0; i < 1024; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
  }

  // Thin gold boundary pinstripes top and bottom
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 24); ctx.lineTo(1024, 24); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 488); ctx.lineTo(1024, 488); ctx.stroke();

  // Draw bold golden "SBRL" text on front (center 256) and back (center 768)
  const drawSbrlLogo = (centerX, centerY) => {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Golden drop shadow / glow
    ctx.shadowColor = 'rgba(245, 197, 66, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    // Bold serif / slab typography matching the reference image
    ctx.fillStyle = '#f5c542';
    ctx.font = '900 130px "Times New Roman", Georgia, serif';
    ctx.fillText('SBRL', centerX, centerY - 10);

    // Subtle subtext
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 22px monospace';
    ctx.letterSpacing = '4px';
    ctx.fillText('AEROIN SPACETECH', centerX, centerY + 85);
    ctx.restore();
  };

  drawSbrlLogo(256, 256); // Front facet
  drawSbrlLogo(768, 256); // Back facet

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function ThreeScene({ kernel, cameraMode = CAMERA_MODES.TRACKING_ORBIT }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const objectsRef = useRef({});
  const mouseStateRef = useRef({ isDown: false, prevX: 0, prevY: 0, theta: 0.8, phi: 0.35, radius: 45 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Renderer setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 600000);
    camera.position.set(0, 8, 35);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 2. Lighting Setup
    const sunLight = new THREE.DirectionalLight(0xfff8ea, 2.5);
    sunLight.position.set(180, 300, 140);
    sunLight.castShadow = true;
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x40658a, 1.0);
    scene.add(ambientLight);

    const earthAlbedoLight = new THREE.DirectionalLight(0x1a4570, 0.6);
    earthAlbedoLight.position.set(0, -100, 0);
    scene.add(earthAlbedoLight);

    // 3. Deep Space Starfield
    const starCount = 3800;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 260000;
      starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = Math.abs(r * Math.cos(phi)) + 1000;
      starPositions[i + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.8,
      transparent: true,
      opacity: 0.1,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 4. Earth Curvature & Ground Launch Base
    const earthRadius = 637100;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x112848,
      roughness: 0.85,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.position.set(0, -earthRadius, 0);
    scene.add(earthMesh);

    // Atmospheric limb halo
    const haloGeo = new THREE.RingGeometry(earthRadius, earthRadius + 18000, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = Math.PI / 2;
    haloMesh.position.set(0, -earthRadius, 0);
    scene.add(haloMesh);

    // Ground Launch Pad Stand (At y = 0 m)
    const padGroup = new THREE.Group();
    scene.add(padGroup);

    // Circular concrete launch base
    const padGeo = new THREE.CylinderGeometry(18, 19, 0.8, 36);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x242e3d, roughness: 0.9, metalness: 0.1 });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.y = -0.4;
    padMesh.receiveShadow = true;
    padGroup.add(padMesh);

    // Hazard ring markings on pad
    const ringGeo = new THREE.RingGeometry(12, 13.5, 36);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    padGroup.add(ringMesh);

    // Launch pedestal holding the rocket
    const pedestalGeo = new THREE.CylinderGeometry(1.5, 2.0, 0.8, 16);
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
    const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestalMesh.position.y = 0.4;
    padGroup.add(pedestalMesh);

    // Umbilical service tower
    const towerGeo = new THREE.BoxGeometry(1.0, 22, 1.0);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.6, roughness: 0.3 });
    const towerMesh = new THREE.Mesh(towerGeo, towerMat);
    towerMesh.position.set(-8, 11, -3);
    padGroup.add(towerMesh);

    // Tower flashing beacon
    const beaconGeo = new THREE.SphereGeometry(0.25, 12, 12);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(-8, 22.2, -3);
    padGroup.add(beaconMesh);

    // Cloud Deck Layers at ~3km and ~11km
    const cloudGeo1 = new THREE.RingGeometry(100, 45000, 48);
    const cloudMat1 = new THREE.MeshStandardMaterial({
      color: 0xecf4fa,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    const cloudDeck = new THREE.Mesh(cloudGeo1, cloudMat1);
    cloudDeck.rotation.x = -Math.PI / 2;
    cloudDeck.position.set(0, 2800, 0);
    scene.add(cloudDeck);

    // 5. TRANSLUCENT ZERO-PRESSURE BALLOON WITH VISIBLE VERTICAL GORES
    // (Matching reference photo: teardrop/pear envelope with fine vertical ribs and gathered appendix)
    const balloonGroup = new THREE.Group();
    scene.add(balloonGroup);

    // Natural zero-pressure teardrop profile points
    const balloonPoints = [];
    const maxR = 12.0;
    // Top crown hemisphere (y from +12 down to +1.5)
    for (let i = 0; i <= 20; i++) {
      const theta = (i / 20) * (Math.PI * 0.5); // 0 at top apex, PI/2 at shoulder
      const y = 1.5 + 10.5 * Math.cos(theta); // 12.0 down to 1.5
      const r = maxR * Math.sin(theta);
      balloonPoints.push(new THREE.Vector2(r, y));
    }
    // Lower body taper (y from +1.5 down to -12.5)
    for (let i = 1; i <= 24; i++) {
      const t = i / 24;
      const y = 1.5 - 14.0 * t; // down to -12.5
      // Pear/teardrop natural elastica taper
      const r = maxR * Math.cos(t * Math.PI * 0.44) * (1.0 - 0.72 * Math.pow(t, 1.8));
      balloonPoints.push(new THREE.Vector2(Math.max(0.45, r), y));
    }

    const balloonGeo = new THREE.LatheGeometry(balloonPoints, 48);
    const balloonMat = new THREE.MeshPhysicalMaterial({
      color: 0xf5faff,
      roughness: 0.22,
      metalness: 0.05,
      transmission: 0.75, // Translucent polyethylene membrane
      thickness: 1.5,
      ior: 1.45,
      clearcoat: 0.4,
      transparent: true,
      opacity: 0.90,
      side: THREE.DoubleSide,
    });
    const balloonMesh = new THREE.Mesh(balloonGeo, balloonMat);
    balloonMesh.castShadow = true;
    balloonGroup.add(balloonMesh);

    // Visible vertical gores (ribbed meridian bands matching reference photo)
    const goreCount = 28;
    const goreGroup = new THREE.Group();
    const gorePoints3D = balloonPoints.map(p => new THREE.Vector3(p.x * 1.008, p.y, 0));
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

    // Gathered appendix duct / tail hanging below the balloon (clearly visible in reference photo)
    const appendixPoints = [
      new THREE.Vector2(0.45, -12.5),
      new THREE.Vector2(0.35, -13.5),
      new THREE.Vector2(0.20, -15.0),
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

    // 6. SUSPENSION BRIDLE CABLES (DESCENDING FROM BALLOON FLANKS TO ROCKET GONDOLA)
    // Exactly as seen in reference photo: clean vertical suspension lines from balloon body to the sides of the black SBRL band!
    const suspensionGroup = new THREE.Group();
    scene.add(suspensionGroup);

    const cableMat = new THREE.LineBasicMaterial({ color: 0xcfd8dc, linewidth: 2.2 });
    const cableLines = [];
    for (let i = 0; i < 4; i++) {
      const cGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -15, 0)
      ]);
      const cLine = new THREE.Line(cGeo, cableMat);
      suspensionGroup.add(cLine);
      cableLines.push(cLine);
    }

    // 7. AEROIN SPACETECH SBRL LAUNCHER MODEL (EXACT REPLICA OF REFERENCE PHOTO)
    // Structure:
    // A. Golden metallic conical dome nose cone (polished golden chrome)
    // B. Black cylindrical collar band with bold golden "SBRL" typography
    // C. Clustered golden cylindrical / toroidal stage with 4 golden engine bells pointing down
    const rocketGroup = new THREE.Group();
    scene.add(rocketGroup);

    const goldHighlightLight = new THREE.PointLight(0xfff6d6, 1.6, 60);
    goldHighlightLight.position.set(4, 8, 8);
    rocketGroup.add(goldHighlightLight);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf5c026, // Rich metallic gold matching reference image
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
    // Parabolic curved dome tapering up to apex tip
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

    // Tip needle
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

    // Side suspension harness lugs (where the suspension cords attach, left & right)
    const lugMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const lugGeo = new THREE.BoxGeometry(0.18, 0.25, 0.18);
    const lugLeft = new THREE.Mesh(lugGeo, lugMat);
    lugLeft.position.set(-1.32, 0.45, 0);
    rocketGroup.add(lugLeft);

    const lugRight = new THREE.Mesh(lugGeo, lugMat);
    lugRight.position.set(1.32, 0.45, 0);
    rocketGroup.add(lugRight);

    // C. Lower Clustered Golden Stage Bodies & Exhaust Nozzles
    const clusterGroup = new THREE.Group();
    clusterGroup.position.y = -0.68;
    rocketGroup.add(clusterGroup);

    // Central cylindrical core
    const coreGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.05, 32);
    const coreMesh = new THREE.Mesh(coreGeo, goldMat);
    coreMesh.position.y = -0.52;
    coreMesh.castShadow = true;
    clusterGroup.add(coreMesh);

    // 4 outer clustered cylindrical tanks (clearly visible in reference photo)
    const nozzles = [];
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = 0.62 * Math.cos(angle);
      const cz = 0.62 * Math.sin(angle);

      const tankGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.05, 24);
      const tank = new THREE.Mesh(tankGeo, goldMat);
      tank.position.set(cx, -0.52, cz);
      tank.castShadow = true;
      clusterGroup.add(tank);

      // Flared golden rocket exhaust bells (nozzles) pointing down
      const nozzGeo = new THREE.ConeGeometry(0.24, 0.55, 24, 1, true);
      const nozzle = new THREE.Mesh(nozzGeo, goldMat);
      nozzle.position.set(cx, -1.25, cz);
      clusterGroup.add(nozzle);
      nozzles.push(nozzle);
    }

    // 8. HIGH-ALTITUDE VACUUM ROCKET PLUME PARTICLES
    const plumeParticleCount = 240;
    const plumeGeo = new THREE.BufferGeometry();
    const plumePositions = new Float32Array(plumeParticleCount * 3);
    const plumeColors = new Float32Array(plumeParticleCount * 3);
    const plumeSizes = new Float32Array(plumeParticleCount);

    for (let i = 0; i < plumeParticleCount; i++) {
      plumePositions[i * 3] = 0;
      plumePositions[i * 3 + 1] = -1000;
      plumePositions[i * 3 + 2] = 0;

      // Vacuum exhaust colors: bright luminous cyan core with amber/gold outer glow
      plumeColors[i * 3] = 0.35;
      plumeColors[i * 3 + 1] = 0.85;
      plumeColors[i * 3 + 2] = 1.0;

      plumeSizes[i] = 18.0;
    }

    plumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePositions, 3));
    plumeGeo.setAttribute('color', new THREE.BufferAttribute(plumeColors, 3));
    plumeGeo.setAttribute('size', new THREE.BufferAttribute(plumeSizes, 1));

    const plumeMat = new THREE.PointsMaterial({
      size: 18,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const plumePoints = new THREE.Points(plumeGeo, plumeMat);
    scene.add(plumePoints);

    // Save references
    objectsRef.current = {
      balloonGroup,
      balloonMesh,
      suspensionGroup,
      cableLines,
      rocketGroup,
      padGroup,
      beaconMesh,
      plumePoints,
      plumePositions,
      starMat,
      sunLight,
      earthMesh,
      cloudDeck,
    };

    // 9. Mouse Orbit Controls
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
      mouseStateRef.current.phi = Math.max(0.04, Math.min(Math.PI / 2 - 0.04, mouseStateRef.current.phi + dy * 0.007));
    };

    const onMouseUp = () => {
      mouseStateRef.current.isDown = false;
    };

    const onWheel = (e) => {
      mouseStateRef.current.radius = Math.max(6, Math.min(350, mouseStateRef.current.radius + e.deltaY * 0.05));
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

      // 1. UPDATE ATMOSPHERIC SKY BACKGROUND
      // 0 - 11km: daylight cyan -> 18km: navy cobalt -> >32-40km: pure space ink black
      let skyR, skyG, skyB;
      if (altitude < 11000) {
        const t = altitude / 11000;
        skyR = 0.22 - 0.15 * t;
        skyG = 0.53 - 0.35 * t;
        skyB = 0.92 - 0.50 * t;
      } else if (altitude < 28000) {
        const t = (altitude - 11000) / 17000;
        skyR = 0.07 * (1 - t);
        skyG = 0.18 * (1 - t);
        skyB = 0.42 * (1 - t);
      } else {
        skyR = 0.008;
        skyG = 0.008;
        skyB = 0.025;
      }
      rendererRef.current.setClearColor(new THREE.Color(skyR, skyG, skyB), 1.0);

      // Starfield opacity increases above 15 km
      if (obj.starMat) {
        const starOpacity = Math.min(0.95, Math.max(0.05, (altitude - 10000) / 22000));
        obj.starMat.opacity = starOpacity;
      }

      // Flash launch pad tower beacon
      if (obj.beaconMesh) {
        const tSec = performance.now() / 1000;
        obj.beaconMesh.visible = (Math.sin(tSec * 4) > 0);
      }

      // 2. POSITION ROCKET MODEL
      // At ground pad: rests on pedestal at y = 1.8 m visual altitude
      const visualRocketY = hasLaunched ? (altitude * 0.1) + 1.8 : 1.8;

      if (obj.rocketGroup) {
        obj.rocketGroup.position.set(kernel.position.x * 0.01, visualRocketY, kernel.position.z * 0.01);

        const pitchRad = ((kernel.rocket.attitudeRpyDeg.pitch - 90) * Math.PI) / 180;
        const rollRad = (kernel.rocket.attitudeRpyDeg.roll * Math.PI) / 180;
        const yawRad = (kernel.rocket.attitudeRpyDeg.yaw * Math.PI) / 180;
        obj.rocketGroup.rotation.set(pitchRad, yawRad, rollRad);
      }

      // 3. DYNAMIC ZERO-PRESSURE BALLOON EXPANSION & POSITION
      if (obj.balloonGroup) {
        if (isAttached) {
          // Tether length: 14 units in visual 3D scale
          const tetherLengthVisual = 13.5;
          const balloonPosY = visualRocketY + tetherLengthVisual + 12;
          obj.balloonGroup.position.set(kernel.position.x * 0.01, balloonPosY, kernel.position.z * 0.01);
          obj.balloonGroup.visible = true;

          // Extreme balloon expansion from sea level up to 36-40 km near-vacuum
          // At sea level: slender teardrop (scaleXZ: 0.42, scaleY: 1.75)
          // At 38-40 km: giant pumpkin balloon (scaleXZ: 2.75, scaleY: 1.40)
          const inflationFactor = Math.min(1.0, altitude / 38000);
          const currentScaleXZ = 0.42 + 2.35 * Math.pow(inflationFactor, 0.55);
          const currentScaleY = 1.75 - 0.40 * inflationFactor;

          obj.balloonGroup.scale.set(currentScaleXZ, currentScaleY, currentScaleXZ);

          // Update suspension cables (from balloon flanks straight down to the SBRL band sides)
          if (obj.cableLines && obj.rocketGroup) {
            obj.suspensionGroup.visible = true;
            const rPos = obj.rocketGroup.position;
            const cableAttachBalloonY = balloonPosY + (-5.2 * currentScaleY);
            const cableAttachRadius = 7.2 * currentScaleXZ;

            // Connect to left and right suspension lugs on the SBRL band
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
          // Severed: balloon drifts upwards away from the rocket
          obj.balloonGroup.position.y += 0.4;
          if (obj.suspensionGroup) obj.suspensionGroup.visible = false;
        }
      }

      // 4. VACUUM ROCKET PLUME PARTICLES (36-40 km Extreme Under-Expansion Plume)
      const isBurning = rocketStatus === 'STAGE1_BURN' || rocketStatus === 'STAGE2_BURN';
      if (obj.plumePositions && obj.rocketGroup) {
        const positions = obj.plumePositions;
        const count = positions.length / 3;
        const rPos = obj.rocketGroup.position;
        const rRot = obj.rocketGroup.rotation;

        if (isBurning) {
          // Near-vacuum broad plume spread angle (~85 deg)
          const vacSpread = Math.min(3.6, 0.6 + (altitude / 36000) * 3.0);

          for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const age = (i / count);
            const distDown = (age * 15.0 + Math.random() * 2.2);
            const spreadRad = age * vacSpread * (Math.random() * 0.85 + 0.65);
            const spreadAngle = Math.random() * Math.PI * 2;

            const lx = spreadRad * Math.cos(spreadAngle);
            const ly = -1.9 - distDown;
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

      // 5. CAMERA MODES & CONTROLS
      const camera = cameraRef.current;
      const targetPos = obj.rocketGroup.position;

      if (cameraMode === CAMERA_MODES.TRACKING_ORBIT) {
        const { theta, phi, radius } = mouseStateRef.current;
        const camX = targetPos.x + radius * Math.cos(phi) * Math.sin(theta);
        const camY = targetPos.y + radius * Math.sin(phi);
        const camZ = targetPos.z + radius * Math.cos(phi) * Math.cos(theta);

        camera.position.set(camX, camY, camZ);
        camera.lookAt(targetPos.x, targetPos.y, targetPos.z);
      } else if (cameraMode === CAMERA_MODES.GROUND_TRACKER) {
        // Optical Ground Tracker looking up from ground station
        camera.position.set(0, 4, 85);
        camera.lookAt(targetPos.x, targetPos.y, targetPos.z);
        camera.fov = Math.max(1.5, 45 - (altitude / 1000) * 1.1);
        camera.updateProjectionMatrix();
      } else if (cameraMode === CAMERA_MODES.HORIZON_WIDE) {
        // Cinematic Edge of Space Vista
        camera.position.set(targetPos.x + 80, targetPos.y + 14, targetPos.z + 95);
        camera.lookAt(targetPos.x, targetPos.y - 8, targetPos.z);
        camera.fov = 68;
        camera.updateProjectionMatrix();
      } else if (cameraMode === CAMERA_MODES.ONBOARD_POV) {
        // Downward looking onboard camera
        camera.position.set(targetPos.x, targetPos.y - 1.5, targetPos.z);
        camera.lookAt(targetPos.x, targetPos.y - 250, targetPos.z);
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

      {/* Optical Reticle Overlay for Ground Optical Tracker */}
      {cameraMode === CAMERA_MODES.GROUND_TRACKER && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-72 h-72 border border-sky-500/40 rounded-full flex items-center justify-center">
            <div className="absolute w-full h-px bg-sky-500/30" />
            <div className="absolute h-full w-px bg-sky-500/30" />
            <div className="w-4 h-4 border border-sky-400 rounded-full animate-ping" />
            <div className="absolute bottom-3 left-4 text-[10px] font-mono text-sky-400 tracking-wider">
              AEROIN SBRL OPTICAL TRACKER [AZ: {Math.round(kernel.rocket.attitudeRpyDeg.yaw)}° | EL: {Math.max(0, Math.min(90, Math.round(Math.atan2(kernel.position.y, 85) * 180 / Math.PI)))}°]
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
