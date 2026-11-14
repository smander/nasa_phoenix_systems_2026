"""Fetch JPL Horizons apparent az/el and range of the Sun and Earth from lunar-surface sites (validation oracle).

Run once with network access; the result is committed to packages/core/fixtures/horizons.json and never fetched at test time.
Horizons: CENTER='coord@301', COORD_TYPE='GEODETIC', SITE_COORD='E-lon,lat,alt_km' (east-positive for the Moon),
QUANTITIES='4,20' (airless apparent azimuth/elevation; observer range), MEAN_ME frame, 1737.4 km sphere.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import requests

API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
OUT = Path(__file__).resolve().parent.parent / 'packages' / 'core' / 'fixtures' / 'horizons.json'
SITES = {
    'pole-test': (0.0, -89.9),
    'malapert-massif': (-0.2558, -85.9799),
    'connecting-ridge-c1': (-137.17, -89.4398),
    'asymmetric-90e': (90.0, -86.0),
}
WINDOWS = [('2026-10-11 00:00', '2026-10-13 00:00', '6 h'), ('2027-01-14 00:00', '2027-01-18 00:00', '8 h'), ('2029-03-15 00:00', '2029-03-17 00:00', '12 h')]
TARGETS = {'sun': '10', 'earth': '399'}
MONTHS = {m: i + 1 for i, m in enumerate(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])}


def fetch(command: str, lon: float, lat: float, start: str, stop: str, step: str) -> list:
    params = {
        'format': 'text', 'COMMAND': f"'{command}'", 'OBJ_DATA': "'NO'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'",
        'CENTER': "'coord@301'", 'COORD_TYPE': "'GEODETIC'", 'SITE_COORD': f"'{lon},{lat},0'",
        'START_TIME': f"'{start}'", 'STOP_TIME': f"'{stop}'", 'STEP_SIZE': f"'{step}'",
        'QUANTITIES': "'4,20'", 'APPARENT': "'AIRLESS'", 'ANG_FORMAT': "'DEG'", 'CSV_FORMAT': "'YES'",
    }
    r = requests.get(API, params=params, timeout=60)
    r.raise_for_status()
    text = r.text
    body = text.split('$$SOE', 1)[1].split('$$EOE', 1)[0]
    rows = []
    for line in body.strip().splitlines():
        f = [x.strip() for x in line.split(',')]
        # ' 2026-Oct-11 00:00', flag, flag, az, el, delta(au), deldot(km/s)
        y, mon, d = f[0].split()[0].split('-')
        hm = f[0].split()[1]
        utc = f'{y}-{MONTHS[mon]:02d}-{int(d):02d}T{hm}:00Z'
        rows.append({'utc': utc, 'azDeg': float(f[3]), 'elDeg': float(f[4]), 'rangeKm': float(f[5]) * 149597870.7})
    return rows


def main() -> None:
    out = {'source': API, 'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'note': 'airless apparent az/el (QUANTITIES 4) and range (20); MEAN_ME frame', 'cases': []}
    for name, (lon, lat) in SITES.items():
        for start, stop, step in WINDOWS:
            for body, cmd in TARGETS.items():
                rows = fetch(cmd, lon, lat, start, stop, step)
                out['cases'].append({'site': name, 'lonE': lon, 'lat': lat, 'body': body, 'rows': rows})
                print(f'{name:<22} {body:<6} {start}: {len(rows)} rows')
                time.sleep(2)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1))
    print('wrote', OUT)


if __name__ == '__main__':
    main()
