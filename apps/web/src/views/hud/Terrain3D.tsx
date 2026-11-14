// The real lunar south pole in 3D: LOLA heights on a 321 x 321 grid (±240 km, 1.5 km spacing), the Moon's
// curvature, and the Sun as a directional light with shadows at its true direction for the selected hour.
// Everything vertical (terrain heights, curvature drop) is stretched by K, and the light's vertical component
// by the same K: an affine stretch keeps which points are lit or shadowed exactly as in reality.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { STATE_NAMES, timeAt } from '@core/analysis';
import { R_SUN_KM, bodyFixedMatrix, icrfToEarthFixed } from '@core/ephemeris';
import { globalSampler, loadGlobalTiles } from '@core/coords';
import { buildLocalGrid, localFrame, polarFrame } from './terrainFrame';
import type { Grid, TerrainFrame } from './terrainFrame';
import type { SiteDef } from '@core/types';
import { ephemFor } from '../../state/compute';
import type { Analysis } from '../../state/useAnalysis';
import { HUD } from './parts';
import { createEarth, createSun, earthMatrix } from './bodies';
import type { Earth } from './bodies';

const SUN_DIST = 300, EARTH_DIST = 230;   // km from the selected point along the true (stretched) directions
const SUN_R = 7, EARTH_R = 22;            // drawn sizes, enlarged so the bodies read on screen
const MAX_BODY_HEIGHT = 175;              // scene units above the site: high bodies stay in the camera's view

const K = 3;               // vertical exaggeration
const R_KM = 1737.4;

let gridPromise: Promise<Grid> | null = null;
function loadGrid(): Promise<Grid> {
  return (gridPromise ??= (async () => {
    const meta = await (await fetch('data/terrain3d.json')).json();
    const buf = await (await fetch('data/terrain3d.bin')).arrayBuffer();
    const raw = new Int16Array(buf), h = new Float32Array(raw.length);
    for (let k = 0; k < raw.length; k++) h[k] = (raw[k] * meta.heightScale) / 1000;
    return { n: meta.n, half: meta.halfWidthM / 1000, sp: meta.spacingM / 1000, h };
  })());
}

/** Map metres (X toward 90 E, Y toward 0 E) -> world (x right, z toward the viewer, y up). */
function heightAt(g: Grid, xKm: number, yKm: number): number {
  const c = (xKm + g.half) / g.sp, r = (g.half - yKm) / g.sp;
  const c0 = Math.max(0, Math.min(g.n - 2, Math.floor(c))), r0 = Math.max(0, Math.min(g.n - 2, Math.floor(r)));
  const fc = Math.min(1, Math.max(0, c - c0)), fr = Math.min(1, Math.max(0, r - r0)), n = g.n, h = g.h;
  return (h[r0 * n + c0] * (1 - fc) + h[r0 * n + c0 + 1] * fc) * (1 - fr) + (h[(r0 + 1) * n + c0] * (1 - fc) + h[(r0 + 1) * n + c0 + 1] * fc) * fr;
}
function world(g: Grid, xKm: number, yKm: number, lift = 0): THREE.Vector3 {
  const hk = heightAt(g, xKm, yKm), drop = (xKm * xKm + yKm * yKm) / (2 * R_KM);
  return new THREE.Vector3(xKm, K * (hk - drop) + lift, -yKm);
}
/** Distance along `dir` from `base` that puts a body of radius `r` beyond the rim of the terrain disc, so it can never
 *  sink into the ground; never less than `min`. The direction stays exact, only the distance grows. */
function clearOfTerrain(g: Grid, base: THREE.Vector3, dir: THREE.Vector3, min: number, r: number): number {
  // High in the sky: stay inside the camera's view (the direction is still exact, only the distance shrinks)
  const d = dir.y > 0 ? Math.min(min, MAX_BODY_HEIGHT / dir.y) : min;
  const px = base.x + dir.x * d, py = base.y + dir.y * d, pz = base.z + dir.z * d;
  // Clear of the ground already (above it, or outside the terrain disc): keep it there
  if (Math.hypot(px, pz) > g.half + r || py - r > world(g, px, -pz).y + 4) return d;
  // Otherwise push it out along the same direction until it passes the rim of the terrain disc
  const hl = Math.hypot(dir.x, dir.z);
  if (hl < 1e-6) return d;
  const ux = dir.x / hl, uz = dir.z / hl, rim = g.half + r + 12;
  const bu = base.x * ux + base.z * uz, bb = base.x * base.x + base.z * base.z;
  const t = -bu + Math.sqrt(Math.max(0, bu * bu - (bb - rim * rim))); // horizontal distance to the rim circle
  return Math.max(d, t / hl);
}
/** Body-fixed Moon-centred vector -> world direction in a frame (x, K·up, -y), vertical stretched by K. */
function bodyToWorldDir(fr: TerrainFrame, v: [number, number, number]): THREE.Vector3 {
  const r = fr.bodyRaw(v);
  return new THREE.Vector3(r[0], r[2] * K, -r[1]).normalize();
}

/** The polar grid near the south pole; elsewhere a site-centred patch from NASA's global terrain tiles. */
const POLAR_LAT = -82.5; // the polar 3D disc reaches about 82 S
const frames = new Map<string, Promise<TerrainFrame>>();
function frameKeyFor(site: SiteDef): string { return site.lat <= POLAR_LAT ? 'polar' : `local:${site.lat.toFixed(4)}:${site.lonE.toFixed(4)}`; }
function frameFor(site: SiteDef): Promise<TerrainFrame> {
  const key = frameKeyFor(site);
  if (!frames.has(key)) {
    frames.set(key, key === 'polar' ? loadGrid().then(polarFrame)
      : loadGlobalTiles(site.lat, site.lonE, 360).then((tiles) => localFrame(site, buildLocalGrid(site, globalSampler(tiles)))));
    if (frames.size > 6) frames.delete(frames.keys().next().value as string);
  }
  return frames.get(key)!;
}

export function Terrain3D({ a, width, height }: { a: Analysis; width: number; height: number }) {
  const s = a.store, site = a.site!, ev = a.ev!, i = a.t;
  const host = useRef<HTMLDivElement>(null);
  const three = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; sun: THREE.DirectionalLight; mesh: THREE.Mesh; grid: Grid; frame: TerrainFrame; sunBody: THREE.Group; earth: Earth; sunLine: Line2; earthLine: Line2; mats: LineMaterial[] } | null>(null);
  const [ready, setReady] = useState(false);
  const [, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);

  // --- build (again when the view moves between the south pole and a site-centred patch) ---
  const frameKey = frameKeyFor(site);
  useEffect(() => {
    let disposed = false;
    setReady(false);
    frameFor(site).then((frame) => {
      const g = frame.grid;
      if (disposed || !host.current) return;
      let renderer: THREE.WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { setFailed(true); return; }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.current.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, width / height, 1, 5000);
      camera.position.set(0, 470, 760);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = false;
      controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.28;
      controls.target.set(0, 30, 0);
      controls.update();

      // terrain mesh
      const n = g.n, pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const x = -g.half + c * g.sp, y = g.half - r * g.sp, k = r * n + c, w = world(g, x, y);
        pos[k * 3] = w.x; pos[k * 3 + 1] = w.y; pos[k * 3 + 2] = w.z;
        const t = Math.max(0, Math.min(1, (g.h[k] + 4) / 11));      // subtle albedo variation with height
        const v = 0.55 + 0.25 * t; col[k * 3] = v; col[k * 3 + 1] = v * 0.99; col[k * 3 + 2] = v * 0.96;
      }
      const idx: number[] = [];
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
        const k = r * n + c;
        // keep a round cap: drop cells outside the disc of radius `half`
        const x = -g.half + (c + 0.5) * g.sp, y = g.half - (r + 0.5) * g.sp;
        if (x * x + y * y > g.half * g.half) continue;
        idx.push(k, k + n, k + 1, k + 1, k + n, k + n + 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);

      // latitude rings draped on the terrain (86 S, 88 S), polar view only
      if (frame.kind === 'polar') for (const lat of [86, 88]) {
        const rho = (2 * 1737400 * Math.tan(((90 - lat) * Math.PI) / 360)) / 1000, pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 180; k++) { const t = (k / 180) * Math.PI * 2; pts.push(world(g, rho * Math.sin(t), rho * Math.cos(t), 0.6 * K)); }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, dashSize: 4, gapSize: 4 }));
        line.computeLineDistances(); scene.add(line);
      }

      // light: low ambient (earthshine-like) + the Sun
      scene.add(new THREE.HemisphereLight(0x9fb8ff, 0x101318, 0.12));
      const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera as THREE.OrthographicCamera;
      sc.left = -300; sc.right = 300; sc.top = 300; sc.bottom = -300; sc.near = 1; sc.far = 3000;
      sun.shadow.bias = -0.0008; sun.shadow.normalBias = 1.2;
      scene.add(sun); scene.add(sun.target);

      // the real Sun and Earth, and the sight lines from the selected point (depth-tested: terrain hides them)
      const redraw = () => { const t = three.current; if (t) t.renderer.render(t.scene, t.camera); };
      const sunBody = createSun(SUN_R, redraw); scene.add(sunBody);
      const earth = createEarth(EARTH_R, redraw); scene.add(earth.group);
      const mkLine = (color: number, dashed: boolean, w: number) => {
        const m = new LineMaterial({ color, linewidth: w, dashed, dashSize: 6, gapSize: 5, transparent: true, opacity: 0.95 });
        m.resolution.set(width, height);
        const geo = new LineGeometry(); geo.setPositions([0, 0, 0, 1, 1, 1]);
        const line = new Line2(geo, m); line.computeLineDistances(); scene.add(line);
        return { line, m };
      };
      const sl = mkLine(0xffb547, false, 2.4), el = mkLine(0x4fa8ff, true, 2.2);
      three.current = { renderer, scene, camera, controls, sun, mesh, grid: g, frame, sunBody, earth, sunLine: sl.line, earthLine: el.line, mats: [sl.m, el.m] };
      controls.addEventListener('change', () => { renderer.render(scene, camera); setFrame((f) => f + 1); });
      setReady(true);
    }).catch(() => setFailed(true));
    return () => {
      disposed = true;
      const t = three.current;
      if (t) { t.controls.dispose(); t.renderer.dispose(); t.mesh.geometry.dispose(); t.renderer.domElement.remove(); three.current = null; }
    };
  }, [frameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- resize ---
  useEffect(() => {
    const t = three.current; if (!t) return;
    t.renderer.setSize(width, height); t.camera.aspect = width / height; t.camera.updateProjectionMatrix();
    t.mats.forEach((m) => m.resolution.set(width, height));
    t.renderer.render(t.scene, t.camera); setFrame((f) => f + 1);
  }, [width, height, ready]);

  // --- zoom / centre ---
  useEffect(() => {
    const t = three.current; if (!t) return;
    const sxy = t.frame.toXY(site.lat, site.lonE);
    const target = s.centred ? world(t.grid, sxy.x, sxy.y) : new THREE.Vector3(0, 30, 0);
    const dir = t.camera.position.clone().sub(t.controls.target).normalize();
    t.controls.target.copy(target);
    t.camera.position.copy(target.clone().add(dir.multiplyScalar(900 / s.zoom)));
    t.controls.update();
    t.renderer.render(t.scene, t.camera); setFrame((f) => f + 1);
  }, [s.zoom, s.centred, site.id, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- the Sun and Earth at this moment (fractional hour while playing: positions are interpolated) ---
  const eg = ephemFor(a.grid);
  const n = a.grid.n, tf = Math.max(0, Math.min(n - 1, s.t)), i0 = Math.floor(tf), i1 = Math.min(n - 1, i0 + 1), f = tf - i0;
  const lerp3 = (arr: Float64Array): [number, number, number] => [0, 1, 2].map((k) => arr[i0 * 3 + k] * (1 - f) + arr[i1 * 3 + k] * f) as [number, number, number];
  const ms = timeAt(a.grid, tf);
  useEffect(() => {
    const t = three.current; if (!t) return;
    const sunDir = bodyToWorldDir(t.frame, lerp3(eg.sun)), earthDir = bodyToWorldDir(t.frame, lerp3(eg.earth));
    // Earth -> Sun in the scene, unstretched (the globe's orientation is unstretched too)
    const sB = lerp3(eg.sun), eB = lerp3(eg.earth), r = t.frame.bodyRaw([sB[0] - eB[0], sB[1] - eB[1], sB[2] - eB[2]]);
    const earthToSun = new THREE.Vector3(r[0], r[2], -r[1]).normalize();
    const siteXY = t.frame.toXY(site.lat, site.lonE);
    const base = world(t.grid, siteXY.x, siteXY.y, 0.4 * K);
    t.sun.position.copy(sunDir.clone().multiplyScalar(1200));
    t.sun.target.position.set(0, 0, 0);
    const sunPos = base.clone().add(sunDir.clone().multiplyScalar(clearOfTerrain(t.grid, base, sunDir, SUN_DIST, SUN_R * 2)));
    const earthPos = base.clone().add(earthDir.clone().multiplyScalar(clearOfTerrain(t.grid, base, earthDir, EARTH_DIST, EARTH_R * 1.1)));
    t.sunBody.position.copy(sunPos);
    t.earth.group.position.copy(earthPos);
    t.earth.setOrientation(earthMatrix(bodyFixedMatrix(ms), icrfToEarthFixed(ms), t.frame.sceneFromBody));
    t.earth.setSunDir(earthToSun);
    (t.sunLine.geometry as LineGeometry).setPositions([base.x, base.y, base.z, sunPos.x, sunPos.y, sunPos.z]);
    (t.earthLine.geometry as LineGeometry).setPositions([base.x, base.y, base.z, earthPos.x, earthPos.y, earthPos.z]);
    t.sunLine.computeLineDistances(); t.earthLine.computeLineDistances();
    t.renderer.render(t.scene, t.camera);
  }); // every render: time, site and camera all move the bodies

  // --- overlay: project pins and rays ---
  const t = three.current;
  const project = (v: THREE.Vector3) => { if (!t) return null; const p = v.clone().project(t.camera); return p.z > 1 ? null : [((p.x + 1) / 2) * width, ((1 - p.y) / 2) * height]; };
  const pinWorld = (x: SiteDef) => { if (!t) return null; const xy = t.frame.toXY(x.lat, x.lonE); return world(t.grid, xy.x, xy.y); };
  const inPatch = (x: SiteDef) => { if (!t) return false; const xy = t.frame.toXY(x.lat, x.lonE); return Math.hypot(xy.x, xy.y) <= t.grid.half && (t.frame.kind === 'local' || x.lat < 0); };
  const shown = s.sites.filter((x) => (s.compareIds.includes(x.id) || x.id === site.id) && inPatch(x));
  const st = STATE_NAMES[ev.state[i]];
  const selW = pinWorld(site);
  const selP = selW ? project(selW) : null;

  const tt = three.current;
  // body labels: real distances, kept inside the frame (13 px text, ~7 px per character)
  const sunText = `Sun · ${(R_SUN_KM / Math.sin((a.tracks!.sunR[i] * Math.PI) / 180) / 1e6).toFixed(1)} million km${ev.sunUp[i] ? '' : ' · hidden by terrain'}`;
  const earthText = `Earth · ${Math.round(a.tracks!.earthLit[i] * 100)}% lit · ${Math.round(a.tracks!.earthKm[i]).toLocaleString('en-US')} km${ev.earthUp[i] ? '' : ' · hidden'}`;
  const fitX = (x: number, text: string) => { const hw = text.length * 3.6 + 8; return Math.max(hw, Math.min(width - hw, x)); };
  const sunLbl = tt ? project(tt.sunBody.position) : null, earthLbl = tt ? project(tt.earth.group.position) : null;
  // when the Sun and Earth sit close in the sky (around new Earth) their captions would overlap: the Sun's goes below it
  const labelsClash = !!(sunLbl && earthLbl && Math.abs(sunLbl[1] - 22 - (earthLbl[1] - 34)) < 22 && Math.abs(sunLbl[0] - earthLbl[0]) < 260);
  const placed: { x: number; y: number; w: number }[] = [];
  // keep labels off the Sun and Earth (and their captions) and off the selected point where the sight lines start
  if (selP) placed.push({ x: selP[0], y: selP[1] - 26, w: 70 }, { x: selP[0], y: selP[1] - 4, w: 70 });
  for (const [p, r] of [[earthLbl, 46], [sunLbl, 30]] as [number[] | null, number][]) {
    if (!p) continue;
    for (let dy = -r - 34; dy <= r; dy += 26) placed.push({ x: p[0], y: p[1] + dy, w: 2 * r + 120 });
  }
  const pins = !t ? [] : shown.map((x) => ({ x, p: project(pinWorld(x)!) as number[] | null, w: x.name.replace(/ \((best-lit point|peak)\)/, '').length * 7.4 + 24 }))
    .filter((it) => it.p && it.p[0] > 0 && it.p[0] < width && it.p[1] > 0 && it.p[1] < height)
    .sort((u, v) => (u.x.id === site.id ? -1 : v.x.id === site.id ? 1 : u.p![1] - v.p![1]))
    .map(({ x, p, w }) => {
      let best: { lift: number; dx: number } | null = null;
      search: for (const lift of [40, 66, 92, 118, 144, 170, -14, -40, -66]) for (const dx of [0, -90, 90, -170, 170]) {
        const lx = p![0] + dx, ly = p![1] - lift - 26;
        if (lx - w / 2 < 4 || lx + w / 2 > width - 4 || ly < 4) continue;
        if (placed.every((q) => Math.abs(q.x - lx) > (q.w + w) / 2 + 8 || Math.abs(q.y - ly) > 30)) { best = { lift, dx }; break search; }
      }
      if (best) placed.push({ x: p![0] + best.dx, y: p![1] - best.lift - 26, w });
      return { x, p: p!, w, lift: best?.lift ?? 0, dx: best?.dx ?? 0, label: !!best };
    });

  const onClick = (e: React.MouseEvent) => {
    // click on the terrain (not a drag) -> analyse that point
    if (!t || (e.target as Element).closest('.pin')) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, t.camera);
    const hit = ray.intersectObject(t.mesh)[0];
    if (!hit) return;
    const ll = t.frame.fromXY(hit.point.x, -hit.point.z);
    s.addCustom(ll.lat, ll.lonE);
  };
  const down = useRef<[number, number] | null>(null);

  return (
    <div className="terrain3d" style={{ width, height }}
      onPointerDown={(e) => { down.current = [e.clientX, e.clientY]; }}
      onClick={(e) => { const d = down.current; if (d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) < 4) onClick(e); }}>
      <div ref={host} className="terrain3d-gl" aria-hidden="true" />
      {failed && <div className="sub" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>3D view unavailable (WebGL is off in this browser).</div>}
      <svg className="terrain3d-overlay" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img"
        aria-label={`3D view of the terrain around ${site.name}, lit from the Sun's real direction. Drag to rotate.`}>
        <defs><radialGradient id="t3-sun"><stop offset="0" stopColor="#FFF4D6" /><stop offset=".3" stopColor="#FFB547" stopOpacity=".8" /><stop offset="1" stopColor="#FFB547" stopOpacity="0" /></radialGradient></defs>
        {sunLbl && <text x={fitX(sunLbl[0], sunText)} y={labelsClash ? sunLbl[1] + 36 : sunLbl[1] - 22} textAnchor="middle" fontSize={13} fontWeight={650} fill="#FFC56B" fontFamily="var(--font-text)" opacity={ev.sunUp[i] ? 1 : 0.55}>{sunText}</text>}
        {earthLbl && <text x={fitX(earthLbl[0], earthText)} y={earthLbl[1] - 34} textAnchor="middle" fontSize={13} fontWeight={650} fill="#7CC2FF" fontFamily="var(--font-text)" opacity={ev.earthUp[i] ? 1 : 0.55}>{earthText}</text>}
        {pins.map(({ x, p, w, lift, dx, label }) => {
          const isSel = x.id === site.id, r = a.all[x.id];
          const c = isSel ? HUD[st].color : r && r.both >= 40 ? '#4FDDB4' : r && r.sun >= 80 ? '#FFB547' : r && r.earth >= 70 ? '#4FA8FF' : '#9AA4B4';
          const lx = p[0] + dx;
          return (
            <g key={x.id} className="pin" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); s.select(x.id); }} role="button" tabIndex={0} aria-label={'Select ' + x.name} onKeyDown={(e) => { if (e.key === 'Enter') s.select(x.id); }}>
              {isSel && <circle cx={p[0]} cy={p[1]} r={14} fill="none" stroke={c} strokeWidth={2} className="pulse" />}
              {isSel && [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v], k) => <path key={k} d={`M${p[0] + u * 24} ${p[1] + v * 16} v${-v * 9} h${-u * 9}`} fill="none" stroke="#fff" strokeWidth={2} />)}
              <ellipse cx={p[0]} cy={p[1]} rx={8} ry={3.5} fill={c} />
              <title>{x.name}</title>
              {label && <polyline points={lift > 0 ? `${p[0]},${p[1]} ${p[0]},${p[1] - lift + 14} ${lx},${p[1] - lift}` : `${p[0]},${p[1]} ${p[0]},${p[1] - lift - 26} ${lx},${p[1] - lift - 26}`} fill="none" stroke={c} strokeWidth={1.5} />}
              {label && <g transform={`translate(${lx - w / 2} ${p[1] - lift - 26})`}>
                <rect width={w} height={26} rx={13} fill={isSel ? c : 'rgba(26,31,40,.85)'} stroke={isSel ? 'none' : 'rgba(255,255,255,.15)'} />
                <text x={w / 2} y={17.5} textAnchor="middle" fontSize={12.5} fontWeight={600} fill={isSel ? '#05070B' : '#EEF2F7'} fontFamily="var(--font-text)">{x.name.replace(/ \((best-lit point|peak)\)/, '')}</text>
              </g>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
