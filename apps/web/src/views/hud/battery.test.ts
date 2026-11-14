import { describe, expect, it } from 'vitest';
import { batteryCells } from './parts';

describe('batteryCells', () => {
  it('maps charge to lit cells and colour', () => {
    expect(batteryCells(0)).toMatchObject({ cells: 0, colour: 'red' });
    expect(batteryCells(0.1)).toMatchObject({ cells: 1, colour: 'red' });
    expect(batteryCells(0.3)).toMatchObject({ cells: 2, colour: 'amber' });
    expect(batteryCells(0.86)).toMatchObject({ cells: 6, colour: 'green' });
    expect(batteryCells(0.02)).toMatchObject({ cells: 1, colour: 'red' });
    expect(batteryCells(4 / 7)).toMatchObject({ cells: 4, colour: 'amber' });
    expect(batteryCells(0.8)).toMatchObject({ cells: 6, colour: 'green' });
    expect(batteryCells(1)).toMatchObject({ cells: 7, colour: 'green' });
  });
  it('clamps out-of-range charge', () => {
    expect(batteryCells(-0.5).cells).toBe(0);
    expect(batteryCells(2).cells).toBe(7);
  });
});
