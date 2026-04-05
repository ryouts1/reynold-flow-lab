import test from 'node:test';
import assert from 'node:assert/strict';

import { computeReynolds } from '../src/simulation/diagnostics.js';

test('computeReynolds returns U * D / nu', () => {
  const reynolds = computeReynolds({ velocity: 0.06, diameter: 24, viscosity: 0.018 });
  assert.equal(Number(reynolds.toFixed(1)), 80.0);
});
