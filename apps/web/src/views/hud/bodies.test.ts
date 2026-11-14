// The Earth globe must face the Moon with its real sub-lunar point (the spot on Earth with the Moon overhead).
import { Body, EquatorFromVector, GeoVector, MakeTime, RotateVector, Rotation_EQJ_EQD, SiderealTime } from 'astronomy-engine';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bodyFixedMatrix, icrfToEarthFixed, moonCentred } from '@core/ephemeris';
import { earthMatrix } from './bodies';

describe('Earth globe orientation', () => {
  for (const iso of ['2027-01-16T16:00:00Z', '2026-10-11T00:00:00Z', '2029-03-15T06:00:00Z']) {
    it(`faces the Moon with the sub-lunar point at ${iso}`, () => {
      const ms = Date.parse(iso);
      // direction from Earth toward the Moon, in scene axes (x = body y, y = -body z, z = -body x)
      const e = moonCentred(ms).earth;
      const toMoon = new THREE.Vector3(-e[1], e[2], e[0]).normalize();
      // into the globe's local frame (three.js sphere: +y north pole, +x lon 0, -z lon 90 E)
      const m = earthMatrix(bodyFixedMatrix(ms), icrfToEarthFixed(ms));
      const local = toMoon.clone().applyMatrix4(new THREE.Matrix4().copy(m).invert());
      const lat = (Math.asin(local.y) * 180) / Math.PI;
      const lon = (Math.atan2(-local.z, local.x) * 180) / Math.PI;
      // reference: GEOCENTRIC apparent RA/Dec of date of the Moon (no surface parallax), longitude = RA - GAST
      const t = MakeTime(new Date(ms));
      const eq = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(t), GeoVector(Body.Moon, t, true)));
      const refLon = ((((eq.ra - SiderealTime(t)) * 15) % 360) + 540) % 360 - 180;
      expect(Math.abs(lat - eq.dec)).toBeLessThan(0.05);
      expect(Math.abs(((lon - refLon + 540) % 360) - 180)).toBeLessThan(0.05);
    });
  }
});
