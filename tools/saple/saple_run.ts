// Run the real saple CLI on an SPL model (Node only; used by tools/saple/saple_check.ts and the dev server).
// The binary comes from SAPLE_BIN, or from .saple/env.json written by tools/saple/build_saple.sh.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SapleFinding } from '@core/spl';

export interface SapleEnv { bin: string; libPath?: string; version: string; commit?: string }
export interface SapleRun { ok: boolean; exit: number | null; findings: SapleFinding[]; warnings: string[]; ms: number; error?: string }

const envFor = (e: Pick<SapleEnv, 'libPath'>) => (e.libPath
  ? { ...process.env, DYLD_LIBRARY_PATH: e.libPath, LD_LIBRARY_PATH: [e.libPath, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') }
  : process.env);

/** Locate a working saple binary, or null when none is set up on this machine. */
export function findSaple(root: string): SapleEnv | null {
  let found: { bin: string; libPath?: string; commit?: string } | null = null;
  if (process.env.SAPLE_BIN) found = { bin: process.env.SAPLE_BIN, libPath: process.env.SAPLE_LIB };
  else if (existsSync(join(root, '.saple', 'env.json'))) found = JSON.parse(readFileSync(join(root, '.saple', 'env.json'), 'utf8'));
  if (!found || !existsSync(found.bin)) return null;
  const v = spawnSync(found.bin, ['--version'], { env: envFor(found), encoding: 'utf8', timeout: 10000 });
  if (v.status !== 0) return null;
  return { ...found, version: v.stdout.trim() };
}

/** `saple parse`, then `saple --format json analyze <file> --no-auto-load`, in a fresh temporary folder. */
export function runSaple(env: SapleEnv, source: string, fileName = 'mission.spl'): SapleRun {
  const safe = fileName.replace(/[^A-Za-z0-9_.-]/g, '_');
  const dir = mkdtempSync(join(tmpdir(), 'polar-window-saple-'));
  const t0 = Date.now();
  try {
    writeFileSync(join(dir, safe), source);
    const opt = { cwd: dir, env: envFor(env), encoding: 'utf8' as const, timeout: 30000, maxBuffer: 64 * 1024 * 1024 };
    const parse = spawnSync(env.bin, ['parse', safe], opt);
    if (parse.status !== 0) return { ok: false, exit: parse.status, findings: [], warnings: [], ms: Date.now() - t0, error: (parse.stdout + parse.stderr).trim().split('\n').pop() || 'parse failed' };
    const run = spawnSync(env.bin, ['--format', 'json', 'analyze', safe, '--no-auto-load'], opt);
    const warnings = run.stderr.split('\n').filter((l) => /^warning:/i.test(l.trim())).map((l) => l.trim());
    let findings: SapleFinding[];
    try { findings = JSON.parse(run.stdout); } catch { return { ok: false, exit: run.status, findings: [], warnings, ms: Date.now() - t0, error: 'saple gave no JSON: ' + (run.stderr.trim().split('\n').pop() || run.error?.message || '') }; }
    return { ok: true, exit: run.status, findings, warnings, ms: Date.now() - t0 };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
