import test from 'node:test';
import assert from 'node:assert/strict';

import { LBMSolver, buildCylinderObstacleMask } from '../src/simulation/lbmSolver.js';


test('3d obstacle mask covers the cylinder center across the span', () => {
  const { mask, centerX, centerY } = buildCylinderObstacleMask(84, 48, 24, 18, 0.25);
  const middleZ = 12;
  const topZ = 0;

  assert.equal(mask[centerX + (84 * (centerY + (48 * middleZ)))], 1);
  assert.equal(mask[centerX + (84 * (centerY + (48 * topZ)))], 1);
  assert.equal(mask[0], 0);
});


test('solver stays finite over several 3d steps', () => {
  const solver = new LBMSolver({
    width: 72,
    height: 42,
    depth: 20,
    velocity: 0.05,
    viscosity: 0.017,
    diameter: 16,
    spanwiseSeed: 0.004,
  });

  solver.step(24);
  const frame = solver.createFrame({ plane: 'xy', index: 10, maxPoints: 600 });
  const density = solver.sampleDensity();

  assert.ok(Number.isFinite(density));
  assert.ok(density > 0.8 && density < 1.2);
  assert.ok(frame.metrics.maxSpeed < 0.35);
  assert.ok(frame.metrics.maxSpanwiseSpeed > 0);
  assert.ok(frame.slice.width === 72);
  assert.ok(frame.slice.height === 42);
  assert.ok(frame.volume.pointCount >= 0);
  assert.ok(frame.slice.speed.every((value) => Number.isFinite(value)));
  assert.ok(frame.slice.spanwise.every((value) => Number.isFinite(value)));
  assert.ok(frame.slice.vorticity.every((value) => Number.isFinite(value)));
});


test('slice dimensions change with the selected plane', () => {
  const solver = new LBMSolver({
    width: 70,
    height: 38,
    depth: 18,
    diameter: 14,
  });

  const xy = solver.createFrame({ plane: 'xy', index: 9 });
  const xz = solver.createFrame({ plane: 'xz', index: 19 });
  const yz = solver.createFrame({ plane: 'yz', index: 25 });

  assert.equal(xy.slice.width, 70);
  assert.equal(xy.slice.height, 38);
  assert.equal(xz.slice.width, 70);
  assert.equal(xz.slice.height, 18);
  assert.equal(yz.slice.width, 38);
  assert.equal(yz.slice.height, 18);
});
