// The Sun and Earth as real objects in the 3D scene.
// Earth: NASA Blue Marble imagery with Black Marble city lights and real cloud cover (public domain), lit from the
// true Sun direction so its phase is physical, oriented by its real axis and spinning with Greenwich sidereal time.
// Without the imagery it falls back to a globe drawn from Natural Earth land outlines (world-atlas).
// Sun: NASA SDO visible-light disc with a glow. Both are placed along their true directions from the selected point.
import * as THREE from 'three';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';

function rand(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

/** Equirectangular Earth texture: ocean, real land outlines, latitude-based land colours, polar ice. */
export function earthTexture(): THREE.CanvasTexture {
  const W = 2048, H = 1024, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const oc = g.createLinearGradient(0, 0, 0, H);
  oc.addColorStop(0, '#0b2347'); oc.addColorStop(0.5, '#124a86'); oc.addColorStop(1, '#0b2347');
  g.fillStyle = oc; g.fillRect(0, 0, W, H);
  const X = (lon: number) => ((lon + 180) / 360) * W, Y = (lat: number) => ((90 - lat) / 180) * H;
  const landGrad = g.createLinearGradient(0, 0, 0, H);
  [[0, '#e9eef2'], [0.1, '#c9cfc8'], [0.17, '#5b7044'], [0.3, '#4f6e3c'], [0.36, '#a58a58'], [0.42, '#b79a63'], [0.47, '#3f6b34'], [0.53, '#3f6b34'], [0.58, '#b39461'], [0.64, '#a18557'], [0.7, '#56723f'], [0.8, '#6f7b5f'], [0.86, '#dfe6ea'], [1, '#f4f7f9']]
    .forEach(([o, col]) => landGrad.addColorStop(o as number, col as string));
  g.fillStyle = landGrad;
  const topo = land110 as unknown as Topology;
  const fc = feature(topo, topo.objects.land) as unknown as { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
  for (const f of fc.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
    for (const poly of polys) {
      for (const shift of [-360, 0, 360]) {
        g.beginPath();
        for (const ring of poly) {
          // unwrap longitudes so rings crossing the antimeridian stay continuous
          let prev = ring[0][0], off = 0;
          ring.forEach(([lon, lat], k) => {
            if (k > 0) { if (lon - prev > 180) off -= 360; else if (prev - lon > 180) off += 360; }
            prev = lon;
            const x = X(lon + off + shift), y = Y(lat);
            if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
          });
          g.closePath();
        }
        g.fill('evenodd');
      }
    }
  }
  // Antarctica's outline wraps the whole globe: close it down to the pole
  g.fillRect(0, Y(-78), W, H - Y(-78));
  // subtle surface texture
  const r = rand(5);
  for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${(0.02 + r() * 0.04).toFixed(3)})`; g.fillRect(r() * W, r() * H, 2 + r() * 6, 1 + r() * 3); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Soft cloud layer (procedural), denser in the storm belts. */
function cloudTexture(): THREE.CanvasTexture {
  const W = 1024, H = 512, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const r = rand(11);
  for (let k = 0; k < 1400; k++) {
    const band = r();
    const lat = band < 0.35 ? (r() * 2 - 1) * 12 : (r() < 0.5 ? 1 : -1) * (35 + r() * 30);
    const x = r() * W, y = ((90 - lat) / 180) * H, rx = 10 + r() * 46, ry = 4 + r() * 14;
    const grd = g.createRadialGradient(x, y, 0, x, y, rx);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(x, y, rx, ry, (r() - 0.5) * 0.6, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!, grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner); grd.addColorStop(0.18, outer); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** Real imagery (tools/art/build_textures.py, NASA, public domain). Missing files fall back to the drawn maps. */
export const TEXTURE_URLS = {
  day: 'textures/earth-day.jpg',       // Blue Marble: Next Generation, January (NASA Earth Observatory)
  night: 'textures/earth-night.jpg',   // Black Marble 2016 city lights (NASA Earth Observatory)
  clouds: 'textures/earth-clouds.jpg', // cloud cover (NASA Visible Earth)
  sun: 'textures/sun-disc.webp',       // the Sun in visible light (NASA SDO / HMI)
} as const;

const cache = new Map<string, Promise<THREE.Texture>>();
function loadTexture(url: string, srgb = true): Promise<THREE.Texture> {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(url, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; resolve(t); }, undefined, reject);
    }));
  }
  return cache.get(url)!;
}

export interface Earth {
  group: THREE.Group; globe: THREE.Mesh; clouds: THREE.Mesh;
  /** Earth's real orientation; the clouds are fixed to the ground (a single NASA snapshot, no invented drift). */
  setOrientation: (m: THREE.Matrix4) => void;
  /** World-space direction from Earth toward the Sun: sets the day/night terminator and the city lights. */
  setSunDir: (d: THREE.Vector3) => void;
}

const GLOBE_VS = 'varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const GLOBE_FS = `uniform sampler2D dayMap; uniform sampler2D nightMap; uniform vec3 sunDir; uniform float hasNight;
varying vec2 vUv; varying vec3 vN;
void main(){
  float d = dot(normalize(vN), normalize(sunDir));
  vec3 day = texture2D(dayMap, vUv).rgb * (0.025 + 1.15 * max(d, 0.0));
  float dark = 1.0 - smoothstep(-0.06, 0.18, d);
  vec3 night = texture2D(nightMap, vUv).rgb * vec3(1.0, 0.86, 0.62) * 1.6 * dark * hasNight;
  gl_FragColor = vec4(day + night, 1.0);
  #include <colorspace_fragment>
}`;

/** The Earth globe. onChange is called when real imagery has loaded, so a still render can be refreshed. */
export function createEarth(radius: number, onChange?: () => void): Earth {
  const group = new THREE.Group();
  const uniforms = { dayMap: { value: earthTexture() as THREE.Texture }, nightMap: { value: new THREE.Texture() }, sunDir: { value: new THREE.Vector3(1, 0, 0) }, hasNight: { value: 0 } };
  const globe = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), new THREE.ShaderMaterial({ uniforms, vertexShader: GLOBE_VS, fragmentShader: GLOBE_FS }));
  const cloudMat = new THREE.MeshStandardMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, roughness: 1 });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.012, 96, 64), cloudMat);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.08, 64, 48), new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(0.35, 0.62, 1.0, f * 0.9); }',
  }));
  globe.matrixAutoUpdate = false; clouds.matrixAutoUpdate = false;
  group.add(globe, clouds, atmo);
  loadTexture(TEXTURE_URLS.day).then((t) => { uniforms.dayMap.value = t; onChange?.(); }).catch(() => undefined);
  loadTexture(TEXTURE_URLS.night).then((t) => { uniforms.nightMap.value = t; uniforms.hasNight.value = 1; onChange?.(); }).catch(() => undefined);
  loadTexture(TEXTURE_URLS.clouds, false).then((t) => {
    cloudMat.map = null; cloudMat.color.set(0xffffff); cloudMat.alphaMap = t; cloudMat.opacity = 0.95; cloudMat.needsUpdate = true; onChange?.();
  }).catch(() => undefined);
  const setOrientation = (m: THREE.Matrix4) => {
    globe.matrix.copy(m);
    clouds.matrix.copy(m);
  };
  const setSunDir = (d: THREE.Vector3) => { uniforms.sunDir.value.copy(d).normalize(); };
  return { group, globe, clouds, setOrientation, setSunDir };
}

/** The Sun: a real visible-light disc (when the imagery is present) with a warm glow and halo. */
export function createSun(radius: number, onChange?: () => void): THREE.Group {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), new THREE.MeshBasicMaterial({ color: 0xfff6e2 }));
  group.add(core);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,235,1)', 'rgba(255,190,90,0.55)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.setScalar(radius * 9);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,200,120,0.5)', 'rgba(255,160,60,0.18)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.setScalar(radius * 18);
  group.add(halo, glow);
  loadTexture(TEXTURE_URLS.sun).then((t) => {
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    disc.scale.setScalar(radius * 2.05); disc.renderOrder = 2;
    core.visible = false; group.add(disc); onChange?.();
  }).catch(() => undefined);
  return group;
}

// Local sphere axes (three.js SphereGeometry: +y = north pole, +x = longitude 0, -z = 90 E) -> Earth-fixed ->
// ICRF (sidereal rotation, nutation, precession) -> Moon body-fixed (moonM) -> optionally the terrain scene.
/** Earth's orientation in the Moon's body-fixed frame: local sphere axes -> Earth-fixed -> ICRF -> Moon body-fixed. */
export function earthBodyRotation(moonM: number[][], icrfToEf: number[][]): number[][] {
  // Earth-fixed -> ICRF is the transpose of the (orthonormal) ICRF -> Earth-fixed rotation
  const efToIcrf = [0, 1, 2].map((i) => [0, 1, 2].map((j) => icrfToEf[j][i]));
  // local -> Earth-fixed: ef = (lx, -lz, ly)
  const localToEf = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
  return mul3(moonM, mul3(efToIcrf, localToEf));
}

const mul3 = (a: number[][], b: number[][]) => a.map((row) => b[0].map((_, j) => row.reduce((acc, _, k) => acc + row[k] * b[k][j], 0)));
const toMatrix4 = (r: number[][]) => new THREE.Matrix4().set(r[0][0], r[0][1], r[0][2], 0, r[1][0], r[1][1], r[1][2], 0, r[2][0], r[2][1], r[2][2], 0, 0, 0, 0, 1);

/** The same rotation as a three.js matrix in Moon body-fixed coordinates (x, y, z as the body frame). */
export function earthBodyMatrix(moonM: number[][], icrfToEf: number[][]): THREE.Matrix4 { return toMatrix4(earthBodyRotation(moonM, icrfToEf)); }

/** Earth's orientation in the 3D terrain scene: body frame -> scene; the default rows are the south-pole frame
 *  (x = body y, y = -body z, z = -body x); a site-centred frame passes its own rows (east, up, -north). */
export function earthMatrix(moonM: number[][], icrfToEf: number[][], sceneFromBody: number[][] = [[0, 1, 0], [0, 0, -1], [-1, 0, 0]]): THREE.Matrix4 {
  return toMatrix4(mul3(sceneFromBody, earthBodyRotation(moonM, icrfToEf)));
}
