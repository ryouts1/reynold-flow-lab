import test from 'node:test';
import assert from 'node:assert/strict';

import { LBMSolver, buildCircularObstacleMask } from '../src/simulation/lbmSolver.js';

test('obstacle mask covers center of the cylinder', () => {
  const { mask, centerX, centerY } = buildCircularObstacleMask(120, 80, 20, 0.3);
  assert.equal(mask[centerX + (centerY * 120)], 1);
  assert.equal(mask[0], 0);
});

test('solver stays finite over several steps', () => {
  const solver = new LBMSolver({
    width: 120,
    height: 80,
    velocity: 0.04,
    viscosity: 0.025,
    diameter: 18,
  });

  solver.step(40);
  const frame = solver.createFrame();
  const density = solver.sampleDensity();

  assert.ok(Number.isFinite(density));
  assert.ok(density > 0.8 && density < 1.2);
  assert.ok(frame.metrics.maxSpeed < 0.3);
  assert.ok(frame.ux.every((value) => Number.isFinite(value)));
  assert.ok(frame.uy.every((value) => Number.isFinite(value)));
  assert.ok(frame.vorticity.every((value) => Number.isFinite(value)));
});
