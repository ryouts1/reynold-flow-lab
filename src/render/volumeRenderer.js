function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function pointColor(spanwise, intensity) {
  const t = clamp01((spanwise + 1) * 0.5);
  const r = Math.round(40 + (215 * t));
  const g = Math.round(42 + (140 * (1 - Math.abs((t * 2) - 1))));
  const b = Math.round(44 + (215 * (1 - t)));
  const alpha = 0.18 + (0.68 * clamp01(intensity));
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

function rotatePoint(x, y, z, yaw, pitch) {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);

  const x1 = (x * cosYaw) + (z * sinYaw);
  const z1 = (-x * sinYaw) + (z * cosYaw);
  const y1 = (y * cosPitch) - (z1 * sinPitch);
  const z2 = (y * sinPitch) + (z1 * cosPitch);

  return { x: x1, y: y1, z: z2 };
}

export class VolumeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  projectPoint(point, dimensions, yawDegrees = -24, pitch = 0.58) {
    const norm = Math.max(dimensions.width, dimensions.height, dimensions.depth);
    const centeredX = (point.x - (dimensions.width / 2)) / norm;
    const centeredY = ((dimensions.height / 2) - point.y) / norm;
    const centeredZ = (point.z - (dimensions.depth / 2)) / norm;
    const rotated = rotatePoint(centeredX, centeredY, centeredZ, (yawDegrees * Math.PI) / 180, pitch);
    const cameraDistance = 2.6;
    const focal = Math.min(this.canvas.width, this.canvas.height) * 0.92;
    const perspective = focal / (cameraDistance - rotated.z);

    return {
      x: (this.canvas.width * 0.5) + (rotated.x * perspective),
      y: (this.canvas.height * 0.56) - (rotated.y * perspective),
      depth: rotated.z,
    };
  }

  render(frame, options = {}) {
    const { volume } = frame;
    const dimensions = {
      width: volume.width,
      height: volume.height,
      depth: volume.depth,
    };

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#020617';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawBox(dimensions, options.volumeYaw ?? -24);
    this.drawCylinder(volume.cylinder, dimensions, options.volumeYaw ?? -24);
    this.drawPoints(volume.points, dimensions, options.volumeYaw ?? -24);
  }

  drawBox(dimensions, yawDegrees) {
    const corners = [
      { x: 0, y: 0, z: 0 },
      { x: dimensions.width, y: 0, z: 0 },
      { x: dimensions.width, y: dimensions.height, z: 0 },
      { x: 0, y: dimensions.height, z: 0 },
      { x: 0, y: 0, z: dimensions.depth },
      { x: dimensions.width, y: 0, z: dimensions.depth },
      { x: dimensions.width, y: dimensions.height, z: dimensions.depth },
      { x: 0, y: dimensions.height, z: dimensions.depth },
    ].map((point) => this.projectPoint(point, dimensions, yawDegrees));

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    this.ctx.lineWidth = 1;
    for (const [from, to] of edges) {
      this.ctx.beginPath();
      this.ctx.moveTo(corners[from].x, corners[from].y);
      this.ctx.lineTo(corners[to].x, corners[to].y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  drawCylinder(cylinder, dimensions, yawDegrees) {
    const samples = 22;
    const zSlices = [0, Math.floor(dimensions.depth / 2), dimensions.depth];

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(244, 244, 245, 0.24)';
    this.ctx.lineWidth = 1.1;

    for (const z of zSlices) {
      this.ctx.beginPath();
      for (let sample = 0; sample <= samples; sample += 1) {
        const angle = (sample / samples) * Math.PI * 2;
        const point = this.projectPoint({
          x: cylinder.centerX + (Math.cos(angle) * cylinder.radius),
          y: cylinder.centerY + (Math.sin(angle) * cylinder.radius),
          z,
        }, dimensions, yawDegrees);

        if (sample === 0) {
          this.ctx.moveTo(point.x, point.y);
        } else {
          this.ctx.lineTo(point.x, point.y);
        }
      }
      this.ctx.stroke();
    }

    for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const start = this.projectPoint({
        x: cylinder.centerX + (Math.cos(angle) * cylinder.radius),
        y: cylinder.centerY + (Math.sin(angle) * cylinder.radius),
        z: 0,
      }, dimensions, yawDegrees);
      const end = this.projectPoint({
        x: cylinder.centerX + (Math.cos(angle) * cylinder.radius),
        y: cylinder.centerY + (Math.sin(angle) * cylinder.radius),
        z: dimensions.depth,
      }, dimensions, yawDegrees);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawPoints(points, dimensions, yawDegrees) {
    if (!points.length) {
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '12px system-ui';
      this.ctx.fillText('wake points are not visible yet', 16, 24);
      return;
    }

    const projected = [];
    for (let base = 0; base < points.length; base += 5) {
      const position = this.projectPoint({
        x: points[base],
        y: points[base + 1],
        z: points[base + 2],
      }, dimensions, yawDegrees);
      projected.push({
        x: position.x,
        y: position.y,
        depth: position.depth,
        intensity: points[base + 3],
        spanwise: points[base + 4],
      });
    }

    projected.sort((left, right) => left.depth - right.depth);

    for (const point of projected) {
      const radius = 1.2 + (2.6 * point.intensity);
      this.ctx.fillStyle = pointColor(point.spanwise, point.intensity);
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}
