import {
  GRID_WIDTH,
  GRID_HEIGHT,
  CYLINDER_X_RATIO,
  PROBE_OFFSET,
} from './config.js';
import { clamp, computeReynolds } from './diagnostics.js';

const DIRECTIONS_X = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const DIRECTIONS_Y = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const WEIGHTS = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const OPPOSITE = [0, 3, 4, 1, 2, 7, 8, 5, 6];

export function buildCircularObstacleMask(width, height, diameter, xRatio = CYLINDER_X_RATIO) {
  const mask = new Uint8Array(width * height);
  const radius = diameter / 2;
  const centerX = Math.round(width * xRatio);
  const centerY = Math.round(height / 2);
  const radiusSquared = radius * radius;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if ((dx * dx) + (dy * dy) <= radiusSquared) {
        mask[x + (y * width)] = 1;
      }
    }
  }

  return {
    mask,
    centerX,
    centerY,
    radius,
  };
}

function createDistributionSet(size) {
  return Array.from({ length: 9 }, () => new Float32Array(size));
}

export class LBMSolver {
  constructor(params = {}) {
    this.width = params.width ?? GRID_WIDTH;
    this.height = params.height ?? GRID_HEIGHT;
    this.size = this.width * this.height;
    this.f = createDistributionSet(this.size);
    this.next = createDistributionSet(this.size);
    this.ux = new Float32Array(this.size);
    this.uy = new Float32Array(this.size);
    this.vorticity = new Float32Array(this.size);
    this.reuseEquilibrium = new Float32Array(9);
    this.iteration = 0;
    this.reset(params);
  }

  reset(params = {}) {
    this.params = {
      velocity: clamp(params.velocity ?? 0.05, 0.01, 0.1),
      viscosity: clamp(params.viscosity ?? 0.02, 0.008, 0.06),
      diameter: clamp(params.diameter ?? 24, 14, 42),
      stepsPerFrame: params.stepsPerFrame ?? 2,
    };

    this.omega = 1 / ((3 * this.params.viscosity) + 0.5);
    this.reynolds = computeReynolds(this.params);

    const obstacle = buildCircularObstacleMask(
      this.width,
      this.height,
      this.params.diameter,
      CYLINDER_X_RATIO,
    );

    this.obstacle = obstacle.mask;
    this.cylinder = {
      centerX: obstacle.centerX,
      centerY: obstacle.centerY,
      radius: obstacle.radius,
    };
    this.probe = {
      x: Math.min(this.width - 8, Math.round(obstacle.centerX + obstacle.radius + PROBE_OFFSET)),
      y: Math.min(this.height - 6, obstacle.centerY + Math.max(4, Math.round(obstacle.radius * 0.6))),
    };

    this.iteration = 0;
    this.initializeField();
    this.computeMacroscopicFields();
  }

  initializeField() {
    const rho = 1;
    const ux = this.params.velocity;
    const uy = 0;
    const equilibrium = this.computeEquilibrium(rho, ux, uy, this.reuseEquilibrium);

    for (let dir = 0; dir < 9; dir += 1) {
      const distribution = this.f[dir];
      const nextDistribution = this.next[dir];
      distribution.fill(equilibrium[dir]);
      nextDistribution.fill(0);
    }

    for (let index = 0; index < this.size; index += 1) {
      if (this.obstacle[index]) {
        for (let dir = 0; dir < 9; dir += 1) {
          this.f[dir][index] = WEIGHTS[dir];
        }
      }
    }
  }

  computeEquilibrium(rho, ux, uy, target = new Float32Array(9)) {
    const velocitySquared = ux * ux + (uy * uy);

    for (let dir = 0; dir < 9; dir += 1) {
      const cu = 3 * ((DIRECTIONS_X[dir] * ux) + (DIRECTIONS_Y[dir] * uy));
      target[dir] = WEIGHTS[dir] * rho * (1 + cu + (0.5 * cu * cu) - (1.5 * velocitySquared));
    }

    return target;
  }

  step(steps = 1) {
    for (let i = 0; i < steps; i += 1) {
      this.stepOnce();
    }
  }

  stepOnce() {
    for (let dir = 0; dir < 9; dir += 1) {
      this.next[dir].fill(0);
    }

    for (let y = 0; y < this.height; y += 1) {
      const rowOffset = y * this.width;
      for (let x = 0; x < this.width; x += 1) {
        const index = rowOffset + x;

        if (this.obstacle[index]) {
          continue;
        }

        let rho = 0;
        for (let dir = 0; dir < 9; dir += 1) {
          rho += this.f[dir][index];
        }

        if (!Number.isFinite(rho) || rho < 1e-8) {
          rho = 1;
        }

        const ux = (
          this.f[1][index]
          + this.f[5][index]
          + this.f[8][index]
          - this.f[3][index]
          - this.f[6][index]
          - this.f[7][index]
        ) / rho;
        const uy = (
          this.f[2][index]
          + this.f[5][index]
          + this.f[6][index]
          - this.f[4][index]
          - this.f[7][index]
          - this.f[8][index]
        ) / rho;

        const equilibrium = this.computeEquilibrium(rho, ux, uy, this.reuseEquilibrium);

        for (let dir = 0; dir < 9; dir += 1) {
          const postCollision = this.f[dir][index] + (this.omega * (equilibrium[dir] - this.f[dir][index]));
          const nextX = x + DIRECTIONS_X[dir];
          let nextY = y + DIRECTIONS_Y[dir];

          if (nextY < 0) {
            nextY = this.height - 1;
          } else if (nextY >= this.height) {
            nextY = 0;
          }

          if (nextX < 0 || nextX >= this.width) {
            continue;
          }

          const targetIndex = nextX + (nextY * this.width);
          if (this.obstacle[targetIndex]) {
            this.next[OPPOSITE[dir]][index] = postCollision;
          } else {
            this.next[dir][targetIndex] = postCollision;
          }
        }
      }
    }

    this.applyInletBoundary();
    this.applyOutletBoundary();

    const swap = this.f;
    this.f = this.next;
    this.next = swap;
    this.iteration += 1;
  }

  applyInletBoundary() {
    const columns = 3;
    const amplitude = Math.min(0.0035, this.params.velocity * 0.08);

    for (let y = 0; y < this.height; y += 1) {
      const rowOffset = y * this.width;
      const perturbation = amplitude * Math.sin(((2 * Math.PI * y) / this.height) + (this.iteration * 0.045));
      const equilibrium = this.computeEquilibrium(1, this.params.velocity, perturbation, this.reuseEquilibrium);

      for (let x = 0; x < columns; x += 1) {
        const index = rowOffset + x;
        if (this.obstacle[index]) {
          continue;
        }
        for (let dir = 0; dir < 9; dir += 1) {
          this.next[dir][index] = equilibrium[dir];
        }
      }
    }
  }

  applyOutletBoundary() {
    const boundaryColumn = this.width - 1;
    const sourceColumn = this.width - 2;

    for (let y = 0; y < this.height; y += 1) {
      const boundaryIndex = boundaryColumn + (y * this.width);
      const sourceIndex = sourceColumn + (y * this.width);

      if (this.obstacle[boundaryIndex]) {
        continue;
      }

      for (let dir = 0; dir < 9; dir += 1) {
        this.next[dir][boundaryIndex] = this.next[dir][sourceIndex];
      }
    }
  }

  computeMacroscopicFields() {
    let averageSpeedAccumulator = 0;
    let fluidCellCount = 0;
    let maxSpeed = 0;

    for (let index = 0; index < this.size; index += 1) {
      if (this.obstacle[index]) {
        this.ux[index] = 0;
        this.uy[index] = 0;
        continue;
      }

      let rho = 0;
      for (let dir = 0; dir < 9; dir += 1) {
        rho += this.f[dir][index];
      }

      if (!Number.isFinite(rho) || rho < 1e-8) {
        rho = 1;
      }

      const ux = (
        this.f[1][index]
        + this.f[5][index]
        + this.f[8][index]
        - this.f[3][index]
        - this.f[6][index]
        - this.f[7][index]
      ) / rho;
      const uy = (
        this.f[2][index]
        + this.f[5][index]
        + this.f[6][index]
        - this.f[4][index]
        - this.f[7][index]
        - this.f[8][index]
      ) / rho;

      this.ux[index] = ux;
      this.uy[index] = uy;

      const speed = Math.hypot(ux, uy);
      averageSpeedAccumulator += speed;
      maxSpeed = Math.max(maxSpeed, speed);
      fluidCellCount += 1;
    }

    let maxAbsVorticity = 0;
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const index = x + (y * this.width);
        if (this.obstacle[index]) {
          this.vorticity[index] = 0;
          continue;
        }

        const leftX = x === 0 ? 0 : x - 1;
        const rightX = x === this.width - 1 ? this.width - 1 : x + 1;
        const downY = y === 0 ? this.height - 1 : y - 1;
        const upY = y === this.height - 1 ? 0 : y + 1;

        const left = leftX + (y * this.width);
        const right = rightX + (y * this.width);
        const down = x + (downY * this.width);
        const up = x + (upY * this.width);

        const dUyDx = 0.5 * (this.uy[right] - this.uy[left]);
        const dUxDy = 0.5 * (this.ux[up] - this.ux[down]);
        const vort = dUyDx - dUxDy;

        this.vorticity[index] = vort;
        maxAbsVorticity = Math.max(maxAbsVorticity, Math.abs(vort));
      }
    }

    const probeIndex = this.probe.x + (this.probe.y * this.width);
    this.metrics = {
      iteration: this.iteration,
      reynolds: this.reynolds,
      averageSpeed: fluidCellCount > 0 ? averageSpeedAccumulator / fluidCellCount : 0,
      maxSpeed,
      maxAbsVorticity,
      probeValue: this.uy[probeIndex],
      probeX: this.probe.x,
      probeY: this.probe.y,
    };

    return this.metrics;
  }

  createFrame() {
    const metrics = this.computeMacroscopicFields();

    return {
      width: this.width,
      height: this.height,
      obstacle: this.obstacle,
      ux: this.ux,
      uy: this.uy,
      vorticity: this.vorticity,
      cylinder: this.cylinder,
      probe: this.probe,
      metrics,
      params: this.params,
    };
  }

  sampleDensity() {
    let sum = 0;
    let count = 0;

    for (let index = 0; index < this.size; index += 1) {
      if (this.obstacle[index]) {
        continue;
      }

      let rho = 0;
      for (let dir = 0; dir < 9; dir += 1) {
        rho += this.f[dir][index];
      }
      sum += rho;
      count += 1;
    }

    return count > 0 ? sum / count : 0;
  }
}
