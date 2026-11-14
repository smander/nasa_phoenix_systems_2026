// Smoke test: the whole app renders both views against the real data files (fetch served from public/).
import { readFileSync } from 'node:fs';
import { act, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string) => {
    const path = new URL('../public/' + String(url).replace(/^\.?\//, ''), import.meta.url);
    const buf = readFileSync(path);
    return { ok: true, status: 200, json: async () => JSON.parse(buf.toString('utf8')), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
  });
  // jsdom lacks these
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as unknown as MediaQueryList);
  window.scrollTo = () => {};
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

describe('Polar Window app (HUD)', () => {
  it('renders the Mission dashboard for Malapert Massif with real numbers', async () => {
    const { App } = await import('./App');
    await act(async () => { render(<App />); });
    await screen.findByText('Rules passing', {}, { timeout: 10000 });
    expect(screen.getByText('Landing sites')).toBeInTheDocument();
    expect(screen.getByText('Power system')).toBeInTheDocument();
    expect(screen.getByText('Sky track')).toBeInTheDocument();
    expect(screen.getByText('Landing window')).toBeInTheDocument();
    expect(screen.getAllByText('69%').length).toBeGreaterThan(0);   // sunlit, January 2027
    expect(screen.getAllByText('Pass').length).toBe(5);
  });

  it('switches to the Check tab with the five rules and the SAPLE model', async () => {
    const { useStore } = await import('./state/store');
    await act(async () => { useStore.getState().setTab('check'); });
    expect((await screen.findAllByText('Sunlight for the whole stay')).length).toBeGreaterThanOrEqual(1); // rule list, and the network panel once it loads
    expect(screen.getByText('polar_window_malapert_massif.spl')).toBeInTheDocument();
    expect(screen.getByText('Artificial intelligence check')).toBeInTheDocument();
  });
});
