const A = require('astronomy-engine');
const fs = require('fs');
const terrain = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../data/terrain.json'), 'utf8'));
const D2R = Math.PI / 180, R2D = 180 / Math.PI, R = 1737.4, KM = A.KM_PER_AU;
const Rz = t => { const c = Math.cos(t), s = Math.sin(t); return [[c, s, 0], [-s, c, 0], [0, 0, 1]]; };
const Rx = t => { const c = Math.cos(t), s = Math.sin(t); return [[1, 0, 0], [0, c, s], [0, -s, c]]; };
const mul = (M, N) => M.map((r, i) => N[0].map((_, j) => r.reduce((a, _, k) => a + M[i][k] * N[k][j], 0)));
const mv = (M, v) => M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const t0 = Date.UTC(2027, 0, 1), n = 30 * 24 + 1;
const frames = [];
for (let i = 0; i < n; i++) {
  const t = A.MakeTime(new Date(t0 + i * 3600e3));
  const ax = A.RotationAxis(A.Body.Moon, t);
  const M = mul(Rz(ax.spin * D2R), mul(Rx((90 - ax.dec) * D2R), Rz((90 + ax.ra * 15) * D2R)));
  const s = A.BackdatePosition(t, A.Body.Moon, A.Body.Sun, true), e = A.BackdatePosition(t, A.Body.Moon, A.Body.Earth, true);
  const lib = A.Libration(t);
  frames.push({ S: mv(M, [s.x * KM, s.y * KM, s.z * KM]), E: mv(M, [e.x * KM, e.y * KM, e.z * KM]), sAU: Math.hypot(s.x, s.y, s.z), lib: [lib.elon, lib.elat] });
}
const r3 = v => Math.round(v * 1000) / 1000;
const sites = terrain.sites.map(site => {
  const la = site.lat * D2R, lo = site.lonE * D2R, rr = R + site.elevM / 1000;
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east = [-Math.sin(lo), Math.cos(lo), 0], north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const azel = v => { const d = [v[0] - up[0] * rr, v[1] - up[1] * rr, v[2] - up[2] * rr];
    const E = dot(d, east), N = dot(d, north), U = dot(d, up);
    return [r3(((Math.atan2(E, N) * R2D) + 360) % 360), r3(Math.atan2(U, Math.hypot(E, N)) * R2D), Math.hypot(...d)]; };
  const sun = [], earth = [];
  for (const f of frames) { const a = azel(f.S), b = azel(f.E); sun.push([a[0], a[1]]); earth.push([b[0], b[1], r3(Math.asin(6371.0084 / b[2]) * R2D)]); }
  return { ...site, sun, earth };
});
const out = { t0: new Date(t0).toISOString(), stepH: 1, n, sunRadiusDeg: frames.map(f => r3(Math.asin(695700 / (f.sAU * KM)) * R2D)),
  libration: frames.map(f => [r3(f.lib[0]), r3(f.lib[1])]), sites, relief: terrain.relief };
fs.writeFileSync(require('path').join(__dirname, '../data/mockdata.json'), JSON.stringify(out));
for (const s of sites) {
  const sunUp = s.sun.filter(p => p[1] > -0.27).length / n, eUp = s.earth.filter(p => p[1] > -p[2]).length / n;
  console.log(s.name.padEnd(22), 'flat-horizon Sun', (100 * sunUp).toFixed(0) + '%', 'Earth', (100 * eUp).toFixed(0) + '%', 'Sun el max', Math.max(...s.sun.map(p => p[1])).toFixed(2));
}
console.log('bytes', fs.statSync(require('path').join(__dirname, '../data/mockdata.json')).size);
