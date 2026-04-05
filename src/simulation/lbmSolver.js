import {
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_DEPTH,
  CYLINDER_X_RATIO,
  PROBE_OFFSET,
  VOLUME_MAX_POINTS,
} from './config.js';
import { clamp, computeReynolds } from './diagnostics.js';

const CX = [
  0,
  1, -1, 0, 0, 0, 0,
  1, -1, 1, -1,
  1, -1, 1, -1,
  0, 0, 0, 0,
];
const CY = [
  0,
  0, 0, 1, -1, 0, 0,
  1, 1, -1, -1,
  0, 0, 0, 0,
  1, -1, 1, -1,
];
const CZ = [
  0,
  0, 0, 0, 0, 1, -1,
  0, 0, 0, 0,
  1, 1, -1, -1,
  1, 1, -1, -1,
];

const WEIGHTS = [
  1 / 3,
  1 / 18, 1 / 18, 1 / 18, 1 / 18, 1 / 18, 1 / 18,
  1 / 36, 1 / 36, 1 / 36, 1 / 36,
  1 / 36, 1 / 36, 1 / 36, 1 / 36,
  1 / 36, 1 / 36, 1 / 36, 1 / 36,
];

const OPPOSITE = [
  0,
  2, 1, 4, 3, 6, 5,
  10, 9, 8, 7,
  14, 13, 12, 11,
  18, 17, 16, 15,
];

function createDistributionSet(size) {
  return Array.from({ length: 19 }, () => new Float32Array(size));
}

function wrapIndex(value, max) {
  if (value < 0) {
    return max - 1;
  }
  if (value >= max) {
    return 0;
  }
  return value;
}

function collectTransferables(frame) {
  return [
    frame.slice.obstacle.buffer,
    frame.slice.velocityA.buffer,
    frame.slice.velocityB.buffer,
    frame.slice.speed.buffer,
    frame.slice.spanwise.buffer,
    frame.slice.vorticity.buffer,
    frame.volume.points.buffer,
  ];
}

export function buildCylinderObstacleMask(width, height, depth, diameter, xRatio = CYLINDER_X_RATIO) {
  const mask = new Uint8Array(width * height * depth);
  const radius = diameter / 2;
  const centerX = Math.round(width * xRatio);
  const centerY = Math.round(height / 2);
  const centerZ = Math.round(depth / 2);
  const radiusSquared = radius * radius;

  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      const rowOffset = width * (y + (height * z));
      for (let x = 0; x < width; x += 1) {
        const dx = x - centerX;
        const dy = y - centerY;
        if ((dx * dx) + (dy * dy) <= radiusSquared) {
          mask[rowOffset + x] = 1;
        }
      }
    }
  }

  return {
    mask,
    centerX,
    centerY,
    centerZ,
    radius,
  };
}

export class LBMSolver {
  constructor(params = {}) {
    this.width = params.width ?? GRID_WIDTH;
    this.height = params.height ?? GRID_HEIGHT;
    this.depth = params.depth ?? GRID_DEPTH;
    this.size = this.width * this.height * this.depth;
    this.f = createDistributionSet(this.size);
    this.next = createDistributionSet(this.size);
    this.rho = new Float32Array(this.size);
    this.ux = new Float32Array(this.size);
    this.uy = new Float32Array(this.size);
    this.uz = new Float32Array(this.size);
    this.omegaX = new Float32Array(this.size);
    this.omegaY = new Float32Array(this.size);
    this.omegaZ = new Float32Array(this.size);
    this.vorticityMagnitude = new Float32Array(this.size);
    this.reuseEquilibrium = new Float32Array(19);
    this.iteration = 0;
    this.reset(params);
  }

  index(x, y, z) {
    return x + (this.width * (y + (this.height * z)));
  }

  reset(params = {}) {
    this.params = {
      velocity: clamp(params.velocity ?? 0.056, 0.02, 0.08),
      viscosity: clamp(params.viscosity ?? 0.016, 0.009, 0.03),
      diameter: clamp(params.diameter ?? 18, 12, 22),
      stepsPerFrame: params.stepsPerFrame ?? 1,
      spanwiseSeed: clamp(params.spanwiseSeed ?? 0.0045, 0, 0.012),
    };

    this.omega = 1 / ((3 * this.params.viscosity) + 0.5);
    this.reynolds = computeReynolds(this.params);

    const obstacle = buildCylinderObstacleMask(
      this.width,
      this.height,
      this.depth,
      this.params.diameter,
      CYLINDER_X_RATIO,
    );

    this.obstacle = obstacle.mask;
    this.cylinder = {
      centerX: obstacle.centerX,
      centerY: obstacle.centerY,
      centerZ: obstacle.centerZ,
      radius: obstacle.radius,
      span: this.depth,
    };

    this.probe = {
      x: Math.min(this.width - 8, Math.round(obstacle.centerX + obstacle.radius + PROBE_OFFSET)),
      y: Math.min(this.height - 6, obstacle.centerY + Math.max(4, Math.round(obstacle.radius * 0.6))),
      z: Math.floor(this.depth / 2),
    };

    this.iteration = 0;
    this.initializeField();
    this.computeMacroscopicFields();
  }

  initializeField() {
    for (let dir = 0; dir < 19; dir += 1) {
      this.next[dir].fill(0);
    }

    for (let z = 0; z < this.depth; z += 1) {
      const zWave = Math.sin((2 * Math.PI * (z + 0.5)) / this.depth);
      for (let y = 0; y < this.height; y += 1) {
        const yEnvelope = Math.sin((Math.PI * (y + 0.5)) / this.height);
        for (let x = 0; x < this.width; x += 1) {
          const index = this.index(x, y, z);

          if (this.obstacle[index]) {
            for (let dir = 0; dir < 19; dir += 1) {
              this.f[dir][index] = WEIGHTS[dir];
            }
            continue;
          }

          const ux = this.params.velocity;
          const uy = 0;
          const uz = this.params.spanwiseSeed * 0.45 * zWave * yEnvelope;
          const equilibrium = this.computeEquilibrium(1, ux, uy, uz, this.reuseEquilibrium);

          for (let dir = 0; dir < 19; dir += 1) {
            this.f[dir][index] = equilibrium[dir];
          }
        }
      }
    }
  }

  computeEquilibrium(rho, ux, uy, uz, target = new Float32Array(19)) {
    const velocitySquared = (ux * ux) + (uy * uy) + (uz * uz);

    for (let dir = 0; dir < 19; dir += 1) {
      const cu = 3 * ((CX[dir] * ux) + (CY[dir] * uy) + (CZ[dir] * uz));
      target[dir] = WEIGHTS[dir] * rho * (1 + cu + (0.5 * cu * cu) - (1.5 * velocitySquared));
    }

    return target;
  }

  step(steps = 1) {
    for (let stepIndex = 0; stepIndex < steps; stepIndex += 1) {
      this.stepOnce();
    }
  }

  stepOnce() {
    for (let dir = 0; dir < 19; dir += 1) {
      this.next[dir].fill(0);
    }

    for (let z = 0; z < this.depth; z += 1) {
      for (let y = 0; y < this.height; y += 1) {
        const rowOffset = this.width * (y + (this.height * z));

        for (let x = 0; x < this.width; x += 1) {
          const index = rowOffset + x;

          if (this.obstacle[index]) {
            continue;
          }

          let rho = 0;
          for (let dir = 0; dir < 19; dir += 1) {
            rho += this.f[dir][index];
          }

          if (!Number.isFinite(rho) || rho < 1e-8) {
            rho = 1;
          }

          const ux = (
            this.f[1][index] - this.f[2][index]
            + this.f[7][index] - this.f[8][index] + this.f[9][index] - this.f[10][index]
            + this.f[11][index] - this.f[12][index] + this.f[13][index] - this.f[14][index]
          ) / rho;

          const uy = (
            this.f[3][index] - this.f[4][index]
            + this.f[7][index] + this.f[8][index] - this.f[9][index] - this.f[10][index]
            + this.f[15][index] - this.f[16][index] + this.f[17][index] - this.f[18][index]
          ) / rho;

          const uz = (
            this.f[5][index] - this.f[6][index]
            + this.f[11][index] + this.f[12][index] - this.f[13][index] - this.f[14][index]
            + this.f[15][index] + this.f[16][index] - this.f[17][index] - this.f[18][index]
          ) / rho;

          const equilibrium = this.computeEquilibrium(rho, ux, uy, uz, this.reuseEquilibrium);

          for (let dir = 0; dir < 19; dir += 1) {
            const postCollision = this.f[dir][index] + (this.omega * (equilibrium[dir] - this.f[dir][index]));
            const nextX = x + CX[dir];
            const nextY = wrapIndex(y + CY[dir], this.height);
            const nextZ = wrapIndex(z + CZ[dir], this.depth);

            if (nextX < 0 || nextX >= this.width) {
              continue;
            }

            const targetIndex = this.index(nextX, nextY, nextZ);
            if (this.obstacle[targetIndex]) {
              this.next[OPPOSITE[dir]][index] = postCollision;
            } else {
              this.next[dir][targetIndex] = postCollision;
            }
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
    const lateralAmplitude = Math.min(0.0035, this.params.velocity * 0.07);
    const spanwiseAmplitude = this.params.spanwiseSeed;

    for (let z = 0; z < this.depth; z += 1) {
      const zWave = Math.sin(((2 * Math.PI * z) / this.depth) + (this.iteration * 0.05));
      for (let y = 0; y < this.height; y += 1) {
        const yWave = Math.sin(((2 * Math.PI * y) / this.height) + (this.iteration * 0.04));
        const envelope = Math.sin((Math.PI * (y + 0.5)) / this.height);
        const uy = lateralAmplitude * yWave * Math.cos((2 * Math.PI * z) / this.depth);
        const uz = spanwiseAmplitude * zWave * envelope;
        const equilibrium = this.computeEquilibrium(1, this.params.velocity, uy, uz, this.reuseEquilibrium);

        for (let x = 0; x < columns; x += 1) {
          const index = this.index(x, y, z);
          if (this.obstacle[index]) {
            continue;
          }

          for (let dir = 0; dir < 19; dir += 1) {
            this.next[dir][index] = equilibrium[dir];
          }
        }
      }
    }
  }

  applyOutletBoundary() {
    const boundaryColumn = this.width - 1;
    const sourceColumn = this.width - 2;

    for (let z = 0; z < this.depth; z += 1) {
      for (let y = 0; y < this.height; y += 1) {
        const boundaryIndex = this.index(boundaryColumn, y, z);
        const sourceIndex = this.index(sourceColumn, y, z);

        if (this.obstacle[boundaryIndex]) {
          continue;
        }

        for (let dir = 0; dir < 19; dir += 1) {
          this.next[dir][boundaryIndex] = this.next[dir][sourceIndex];
        }
      }
    }
  }

  computeMacroscopicFields() {
    let averageSpeedAccumulator = 0;
    let fluidCellCount = 0;
    let maxSpeed = 0;
    let maxSpanwiseSpeed = 0;

    for (let index = 0; index < this.size; index += 1) {
      if (this.obstacle[index]) {
        this.rho[index] = 1;
        this.ux[index] = 0;
        this.uy[index] = 0;
        this.uz[index] = 0;
        continue;
      }

      let rho = 0;
      for (let dir = 0; dir < 19; dir += 1) {
        rho += this.f[dir][index];
      }

      if (!Number.isFinite(rho) || rho < 1e-8) {
        rho = 1;
      }

      this.rho[index] = rho;

      const ux = (
        this.f[1][index] - this.f[2][index]
        + this.f[7][index] - this.f[8][index] + this.f[9][index] - this.f[10][index]
        + this.f[11][index] - this.f[12][index] + this.f[13][index] - this.f[14][index]
      ) / rho;

      const uy = (
        this.f[3][index] - this.f[4][index]
        + this.f[7][index] + this.f[8][index] - this.f[9][index] - this.f[10][index]
        + this.f[15][index] - this.f[16][index] + this.f[17][index] - this.f[18][index]
      ) / rho;

      const uz = (
        this.f[5][index] - this.f[6][index]
        + this.f[11][index] + this.f[12][index] - this.f[13][index] - this.f[14][index]
        + this.f[15][index] + this.f[16][index] - this.f[17][index] - this.f[18][index]
      ) / rho;

      this.ux[index] = ux;
      this.uy[index] = uy;
      this.uz[index] = uz;

      const speed = Math.hypot(ux, uy, uz);
      averageSpeedAccumulator += speed;
      maxSpeed = Math.max(maxSpeed, speed);
      maxSpanwiseSpeed = Math.max(maxSpanwiseSpeed, Math.abs(uz));
      fluidCellCount += 1;
    }

    let maxAbsVorticity = 0;

    for (let z = 0; z < this.depth; z += 1) {
      const backZ = wrapIndex(z - 1, this.depth);
      const frontZ = wrapIndex(z + 1, this.depth);

      for (let y = 0; y < this.height; y += 1) {
        const downY = wrapIndex(y - 1, this.height);
        const upY = wrapIndex(y + 1, this.height);

        for (let x = 0; x < this.width; x += 1) {
          const index = this.index(x, y, z);
          if (this.obstacle[index]) {
            this.omegaX[index] = 0;
            this.omegaY[index] = 0;
            this.omegaZ[index] = 0;
            this.vorticityMagnitude[index] = 0;
            continue;
          }

          const leftX = x === 0 ? 0 : x - 1;
          const rightX = x === this.width - 1 ? this.width - 1 : x + 1;

          const left = this.index(leftX, y, z);
          const right = this.index(rightX, y, z);
          const down = this.index(x, downY, z);
          const up = this.index(x, upY, z);
          const back = this.index(x, y, backZ);
          const front = this.index(x, y, frontZ);

          const dUzDy = 0.5 * (this.uz[up] - this.uz[down]);
          const dUyDz = 0.5 * (this.uy[front] - this.uy[back]);
          const dUxDz = 0.5 * (this.ux[front] - this.ux[back]);
          const dUzDx = 0.5 * (this.uz[right] - this.uz[left]);
          const dUyDx = 0.5 * (this.uy[right] - this.uy[left]);
          const dUxDy = 0.5 * (this.ux[up] - this.ux[down]);

          const omegaX = dUzDy - dUyDz;
          const omegaY = dUxDz - dUzDx;
          const omegaZ = dUyDx - dUxDy;
          const vorticityMagnitude = Math.hypot(omegaX, omegaY, omegaZ);

          this.omegaX[index] = omegaX;
          this.omegaY[index] = omegaY;
          this.omegaZ[index] = omegaZ;
          this.vorticityMagnitude[index] = vorticityMagnitude;
          maxAbsVorticity = Math.max(maxAbsVorticity, vorticityMagnitude);
        }
      }
    }

    const probeIndex = this.index(this.probe.x, this.probe.y, this.probe.z);
    this.metrics = {
      iteration: this.iteration,
      reynolds: this.reynolds,
      averageSpeed: fluidCellCount > 0 ? averageSpeedAccumulator / fluidCellCount : 0,
      maxSpeed,
      maxAbsVorticity,
      maxSpanwiseSpeed,
      probeValue: this.uy[probeIndex],
      probeSpanwise: this.uz[probeIndex],
      probeX: this.probe.x,
      probeY: this.probe.y,
      probeZ: this.probe.z,
    };

    return this.metrics;
  }

  extractSlice(view = {}) {
    const plane = view.plane ?? 'xy';
    const fixedAxis = plane === 'xy' ? 'z' : plane === 'xz' ? 'y' : 'x';
    const maxIndex = plane === 'xy'
      ? this.depth - 1
      : plane === 'xz'
        ? this.height - 1
        : this.width - 1;
    const sliceIndex = clamp(Math.round(view.index ?? Math.floor(maxIndex / 2)), 0, maxIndex);

    let sliceWidth = 0;
    let sliceHeight = 0;
    let fetchIndex = null;
    let probe2D = { x: 0, y: 0, onSlice: false };

    if (plane === 'xy') {
      sliceWidth = this.width;
      sliceHeight = this.height;
      fetchIndex = (a, b) => this.index(a, b, sliceIndex);
      probe2D = { x: this.probe.x, y: this.probe.y, onSlice: this.probe.z === sliceIndex };
    } else if (plane === 'xz') {
      sliceWidth = this.width;
      sliceHeight = this.depth;
      fetchIndex = (a, b) => this.index(a, sliceIndex, b);
      probe2D = { x: this.probe.x, y: this.probe.z, onSlice: this.probe.y === sliceIndex };
    } else {
      sliceWidth = this.height;
      sliceHeight = this.depth;
      fetchIndex = (a, b) => this.index(sliceIndex, a, b);
      probe2D = { x: this.probe.y, y: this.probe.z, onSlice: this.probe.x === sliceIndex };
    }

    const sliceSize = sliceWidth * sliceHeight;
    const obstacle = new Uint8Array(sliceSize);
    const velocityA = new Float32Array(sliceSize);
    const velocityB = new Float32Array(sliceSize);
    const speed = new Float32Array(sliceSize);
    const spanwise = new Float32Array(sliceSize);
    const vorticity = new Float32Array(sliceSize);

    let maxAbsVorticity = 0;
    let maxSpeed = 0;
    let maxAbsSpanwise = 0;

    for (let b = 0; b < sliceHeight; b += 1) {
      for (let a = 0; a < sliceWidth; a += 1) {
        const targetIndex = a + (b * sliceWidth);
        const sourceIndex = fetchIndex(a, b);
        obstacle[targetIndex] = this.obstacle[sourceIndex];

        if (plane === 'xy') {
          velocityA[targetIndex] = this.ux[sourceIndex];
          velocityB[targetIndex] = this.uy[sourceIndex];
          vorticity[targetIndex] = this.omegaZ[sourceIndex];
        } else if (plane === 'xz') {
          velocityA[targetIndex] = this.ux[sourceIndex];
          velocityB[targetIndex] = this.uz[sourceIndex];
          vorticity[targetIndex] = this.omegaY[sourceIndex];
        } else {
          velocityA[targetIndex] = this.uy[sourceIndex];
          velocityB[targetIndex] = this.uz[sourceIndex];
          vorticity[targetIndex] = this.omegaX[sourceIndex];
        }

        speed[targetIndex] = Math.hypot(
          this.ux[sourceIndex],
          this.uy[sourceIndex],
          this.uz[sourceIndex],
        );
        spanwise[targetIndex] = this.uz[sourceIndex];

        maxAbsVorticity = Math.max(maxAbsVorticity, Math.abs(vorticity[targetIndex]));
        maxSpeed = Math.max(maxSpeed, speed[targetIndex]);
        maxAbsSpanwise = Math.max(maxAbsSpanwise, Math.abs(spanwise[targetIndex]));
      }
    }

    return {
      plane,
      fixedAxis,
      index: sliceIndex,
      width: sliceWidth,
      height: sliceHeight,
      obstacle,
      velocityA,
      velocityB,
      speed,
      spanwise,
      vorticity,
      probe: probe2D,
      maxAbsVorticity,
      maxSpeed,
      maxAbsSpanwise,
    };
  }

  buildVolumePreview(maxPoints = VOLUME_MAX_POINTS) {
    const threshold = Math.max(0.0025, this.metrics.maxAbsVorticity * 0.22);
    const spanThreshold = Math.max(0.00035, this.metrics.maxSpanwiseSpeed * 0.45);
    const downstreamStart = Math.max(0, Math.round(this.cylinder.centerX + this.cylinder.radius - 1));
    const rawPoints = [];

    for (let z = 0; z < this.depth; z += 1) {
      for (let y = 1; y < this.height - 1; y += 2) {
        for (let x = downstreamStart; x < this.width - 1; x += 2) {
          const index = this.index(x, y, z);
          if (this.obstacle[index]) {
            continue;
          }

          const vort = this.vorticityMagnitude[index];
          const span = Math.abs(this.uz[index]);
          if (vort < threshold && span < spanThreshold) {
            continue;
          }

          const intensity = Math.max(
            vort / Math.max(this.metrics.maxAbsVorticity, 1e-6),
            span / Math.max(this.metrics.maxSpanwiseSpeed, 1e-6),
          );
          const spanNormalized = this.metrics.maxSpanwiseSpeed > 1e-6
            ? clamp(this.uz[index] / this.metrics.maxSpanwiseSpeed, -1, 1)
            : 0;

          rawPoints.push(x, y, z, clamp(intensity, 0, 1), spanNormalized);
        }
      }
    }

    if (rawPoints.length === 0) {
      return {
        width: this.width,
        height: this.height,
        depth: this.depth,
        pointCount: 0,
        points: new Float32Array(0),
        cylinder: this.cylinder,
      };
    }

    const pointCount = rawPoints.length / 5;
    const stride = pointCount > maxPoints ? Math.ceil(pointCount / maxPoints) : 1;
    const limited = [];

    for (let pointIndex = 0; pointIndex < pointCount; pointIndex += stride) {
      const base = pointIndex * 5;
      limited.push(
        rawPoints[base],
        rawPoints[base + 1],
        rawPoints[base + 2],
        rawPoints[base + 3],
        rawPoints[base + 4],
      );
    }

    return {
      width: this.width,
      height: this.height,
      depth: this.depth,
      pointCount: limited.length / 5,
      points: new Float32Array(limited),
      cylinder: this.cylinder,
    };
  }

  createFrame(view = {}) {
    const metrics = this.computeMacroscopicFields();
    const slice = this.extractSlice(view);
    const volume = this.buildVolumePreview(view.maxPoints ?? VOLUME_MAX_POINTS);

    return {
      dimensions: {
        width: this.width,
        height: this.height,
        depth: this.depth,
      },
      slice,
      volume,
      metrics,
      params: this.params,
    };
  }

  createTransferables(frame) {
    return collectTransferables(frame);
  }

  sampleDensity() {
    let sum = 0;
    let count = 0;

    for (let index = 0; index < this.size; index += 1) {
      if (this.obstacle[index]) {
        continue;
      }
      sum += this.rho[index];
      count += 1;
    }

    return count > 0 ? sum / count : 0;
  }
}
