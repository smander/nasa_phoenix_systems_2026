import { describe, expect, it } from 'vitest';
import { attentionSpan } from './NeuralPanel';

describe('attentionSpan', () => {
  it('finds the shortest run of hours holding the given share', () => {
    expect(attentionSpan([0.05, 0.05, 0.4, 0.4, 0.05, 0.05], 0.8)).toEqual([2, 3]);
    expect(attentionSpan([0.25, 0.25, 0.25, 0.25], 0.8)).toEqual([0, 3]);
    expect(attentionSpan([0, 0, 1], 0.8)).toEqual([2, 2]);
  });
});
