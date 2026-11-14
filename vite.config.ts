import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { findSaple, runSaple } from './tools/saple/saple_run';
import type { SapleEnv } from './tools/saple/saple_run';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Local only: POST /api/saple {fileName, source} runs the saple CLI on the model and returns its findings.
 *  Works on the dev and preview servers of a machine that has the CLI (tools/saple/build_saple.sh); never part of the build. */
function sapleLocal(): Plugin {
  const root = new URL('.', import.meta.url).pathname;
  let env: SapleEnv | null = null, checked = 0;
  const saple = () => { if (Date.now() - checked > 60000) { env = findSaple(root); checked = Date.now(); } return env; };
  const send = (res: ServerResponse, code: number, body: unknown) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
  const handler = (req: IncomingMessage, res: ServerResponse) => {
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || '')) return send(res, 403, { available: false });
    const e = saple();
    if (!e) return send(res, 200, { available: false });
    if (req.method !== 'POST') return send(res, 200, { available: true, version: e.version, commit: e.commit });
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return send(res, 415, { available: true, ok: false, error: 'send JSON' });
    let body = '', tooBig = false;
    req.setEncoding('utf8');
    req.on('data', (c: string) => { body += c; if (body.length > 256 * 1024) { tooBig = true; req.destroy(); } });
    req.on('end', () => {
      if (tooBig) return;
      try {
        const { fileName, source } = JSON.parse(body) as { fileName?: string; source?: string };
        if (typeof source !== 'string' || !source.trim()) return send(res, 400, { available: true, ok: false, error: 'no model' });
        send(res, 200, { available: true, version: e.version, commit: e.commit, ...runSaple(e, source, typeof fileName === 'string' ? fileName : 'mission.spl') });
      } catch (err) { send(res, 400, { available: true, ok: false, error: String(err) }); }
    });
  };
  return {
    name: 'polar-window-saple-local',
    configureServer(server) { server.middlewares.use('/api/saple', handler); },
    configurePreviewServer(server) { server.middlewares.use('/api/saple', handler); },
  };
}

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: at('./apps/web'),
  plugins: [react(), sapleLocal()],
  resolve: { alias: { '@core': at('./packages/core/src') } },
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2020', outDir: at('./dist'), emptyOutDir: true },
});
