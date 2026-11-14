// The real Earth for the Sky panorama: the Mission tab's globe (bodies.ts) rendered offscreen as seen from the
// landing site. Everything is in the Moon's body-fixed frame: the globe turns with Earth's real rotation, the Sun
// light comes from the true Sun direction (so the phase is physical), and the camera sits on the line from Earth to
// the site with the local zenith as "up", matching the panorama (up = elevation, right = increasing azimuth).
import * as THREE from 'three';
import { createEarth, earthBodyMatrix } from '../views/hud/bodies';
import { bodyFixedMatrix, icrfToEarthFixed, moonCentred, siteFrame } from '@core/ephemeris';

/** Half-size of the rendered square, in Earth radii (the atmosphere glow reaches ~1.1). */
export const GLOBE_FRAME = 1.25;

export interface GlobeRenderer { render: (ms: number, lat: number, lonE: number, heightM: number) => string; dispose: () => void }

export function createGlobeRenderer(px = 160, onChange?: () => void): GlobeRenderer {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(px, px, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const earth = createEarth(1, onChange);
  scene.add(earth.group);
  scene.add(new THREE.HemisphereLight(0x9fb8ff, 0x101318, 0.06));
  const light = new THREE.DirectionalLight(0xfff1dc, 3.2);
  scene.add(light, light.target);
  const cam = new THREE.OrthographicCamera(-GLOBE_FRAME, GLOBE_FRAME, GLOBE_FRAME, -GLOBE_FRAME, 0.1, 10);
  const unit = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]); return new THREE.Vector3(v[0] / l, v[1] / l, v[2] / l); };

  return {
    render(ms, lat, lonE, heightM) {
      const mc = moonCentred(ms), f = siteFrame(lat, lonE, heightM);
      earth.setOrientation(earthBodyMatrix(bodyFixedMatrix(ms), icrfToEarthFixed(ms)));
      const toSun = unit([mc.sun[0] - mc.earth[0], mc.sun[1] - mc.earth[1], mc.sun[2] - mc.earth[2]]);
      light.position.copy(toSun).multiplyScalar(5);
      earth.setSunDir(toSun);
      cam.position.copy(unit([f.pos[0] - mc.earth[0], f.pos[1] - mc.earth[1], f.pos[2] - mc.earth[2]]).multiplyScalar(4));
      cam.up.set(f.up[0], f.up[1], f.up[2]);
      cam.lookAt(0, 0, 0);
      renderer.render(scene, cam);
      return renderer.domElement.toDataURL('image/png');
    },
    dispose() {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); });
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
