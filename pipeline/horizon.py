"""Terrain horizon masks: the elevation angle of the skyline in 720 directions, for several observer heights.

Geometry (exact on the sphere): a terrain sample at arc distance d (m) with height h_t, seen from an observer
at height h_o above the same sphere, has elevation
    el = atan2((R + h_t) cos(d/R) - (R + h_o), (R + h_t) sin(d/R)).
Curvature and horizon dip are built in. Rays start 2 pixels out (the site's own pixel only encodes its local
slope) and run to 300 km; a 300 km-distant point is lowered by ~4.9 deg, more than lunar relief can raise it.
"""
from __future__ import annotations

from typing import Dict, Sequence

import numpy as np

from .lola import R_M, destination, sample, sample_global

HEIGHTS_M = (0.0, 2.0, 5.0, 10.0, 20.0, 50.0)
N_AZ = 720
MAX_RANGE_M = 300000.0


def elevation_deg(dist_m, terrain_m, observer_m):
    th = np.asarray(dist_m) / R_M
    rt = R_M + np.asarray(terrain_m)
    return np.degrees(np.arctan2(rt * np.cos(th) - (R_M + observer_m), rt * np.sin(th)))


def horizon_masks(dem: np.ndarray, lbl: Dict[str, object], lat: float, lon_e: float,
                  heights_m: Sequence[float] = HEIGHTS_M, max_range_m: float = MAX_RANGE_M) -> dict:
    """Per-azimuth horizon (deg) for each observer height above the local ground.

    Returns {elevM, heightsM, azStepDeg, maskDeg[len(heights)][720], distKm[720] (limiting distance at 2 m), coverage}.
    """
    scale = float(lbl['MAP_SCALE'])
    site_elev = float(sample(dem, lbl, np.array([lat]), np.array([lon_e]))[0])
    az = np.arange(N_AZ) * (360.0 / N_AZ)
    d = np.arange(2 * scale, max_range_m + scale / 4, scale / 2)
    A, Dm = np.meshgrid(az, d, indexing='ij')
    la, lo = destination(lat, lon_e, A, Dm)
    zt = sample(dem, lbl, la, lo)
    inside = ~np.isnan(zt)
    coverage = float(np.mean(inside[:, -1]))
    zt = np.where(inside, zt, -1e5)  # far below any horizon
    masks = []
    dist2 = None
    for hgt in heights_m:
        el = elevation_deg(Dm, zt, site_elev + hgt)
        k = np.argmax(el, axis=1)
        masks.append(el[np.arange(N_AZ), k])
        if hgt == 2.0:
            dist2 = Dm[np.arange(N_AZ), k] / 1000.0
    if dist2 is None:
        dist2 = np.zeros(N_AZ)
    return {
        'elevM': round(site_elev, 1),
        'heightsM': [float(h) for h in heights_m],
        'azStepDeg': 360.0 / N_AZ,
        'maskDeg': [[round(float(v), 3) for v in m] for m in masks],
        'distKm': [round(float(v), 2) for v in dist2],
        'coverage': round(coverage, 3),
        'resM': scale,
    }


def horizon_masks_any(dem: np.ndarray, lbl: Dict[str, object], dem16: np.ndarray, lat: float, lon_e: float,
                      heights_m: Sequence[float] = HEIGHTS_M, max_range_m: float = MAX_RANGE_M) -> dict:
    """Horizon masks anywhere on the Moon. Near the south pole (lat <= -75) rays step through the 240 m polar model and
    fall back to the global 16 px/deg model where they leave it; elsewhere the global model alone is used (~1.9 km)."""
    polar = lat <= -75.0
    scale = float(lbl['MAP_SCALE']) if polar else 1895.21

    def height(la, lo):
        z = sample_global(dem16, la, lo)
        if polar:
            zp = sample(dem, lbl, la, lo)
            z = np.where(np.isnan(zp), z, zp)
        return z

    site_elev = float(height(np.array([lat]), np.array([lon_e]))[0])
    az = np.arange(N_AZ) * (360.0 / N_AZ)
    d = np.arange(2 * scale, max_range_m + scale / 4, scale / 2)
    A, Dm = np.meshgrid(az, d, indexing='ij')
    la, lo = destination(lat, lon_e, A, Dm)
    zt = height(la, lo)
    masks, dist2 = [], np.zeros(N_AZ)
    for hgt in heights_m:
        el = elevation_deg(Dm, zt, site_elev + hgt)
        k = np.argmax(el, axis=1)
        masks.append(el[np.arange(N_AZ), k])
        if hgt == 2.0:
            dist2 = Dm[np.arange(N_AZ), k] / 1000.0
    return {
        'elevM': round(site_elev, 1),
        'heightsM': [float(h) for h in heights_m],
        'azStepDeg': 360.0 / N_AZ,
        'maskDeg': [[round(float(v), 3) for v in m] for m in masks],
        'distKm': [round(float(v), 2) for v in dist2],
        'coverage': 1.0,
        'resM': scale,
    }
