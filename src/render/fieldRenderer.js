function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function speedColor(normalized) {
  const t = clamp01(normalized);
  const r = Math.round(20 + (235 * t));
  const g = Math.round(30 + (160 * Math.pow(t, 0.7)));
  const b = Math.round(50 + (220 * (1 - t)));
  return [r, g, b];
}

function vorticityColor(normalized) {
  const t = clamp01((normalized + 1) * 0.5);
  const r = Math.round(30 + (220 * t));
  const g = Math.round(25 + (180 * (1 - Math.abs((t * 2) - 1))));
  const b = Math.round(30 + (220 * (1 - t)));
  return [r, g, b];
}

function sampleNearest(field, width, height, x, y) {
  const xi = Math.max(0, Math.min(width - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
  return field[xi + (yi * width)];
}

export class FieldRenderer {
  constructor(canvas, legendCanvas, scale = 4) {
    this.canvas = canvas;
    this.legendCanvas = legendCanvas;
    this.ctx = canvas.getContext('2d');
    this.legendCtx = legendCanvas.getContext('2d');
    this.scale = scale;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this.imageData = null;
    this.lastViewMode = 'speed';
  }

  resize(width, height) {
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    this.canvas.width = width * this.scale;
    this.canvas.height = height * this.scale;
    this.imageData = this.offscreenCtx.createImageData(width, height);
  }

  render(frame, options) {
    const { width, height, ux, uy, vorticity, obstacle, cylinder, probe, metrics } = frame;
    if (!this.imageData || this.offscreenCanvas.width !== width || this.offscreenCanvas.height !== height) {
      this.resize(width, height);
    }

    const viewMode = options.viewMode ?? 'speed';
    const data = this.imageData.data;
    const speedScale = Math.max(0.08, metrics.maxSpeed * 1.15);
    const vorticityScale = Math.max(0.02, metrics.maxAbsVorticity * 1.15);

    for (let index = 0; index < obstacle.length; index += 1) {
      const base = index * 4;
      if (obstacle[index]) {
        data[base] = 26;
        data[base + 1] = 26;
        data[base + 2] = 30;
        data[base + 3] = 255;
        continue;
      }

      if (viewMode === 'vorticity') {
        const [r, g, b] = vorticityColor(vorticity[index] / vorticityScale);
        data[base] = r;
        data[base + 1] = g;
        data[base + 2] = b;
        data[base + 3] = 255;
      } else {
        const speed = Math.hypot(ux[index], uy[index]);
        const [r, g, b] = speedColor(speed / speedScale);
        data[base] = r;
        data[base + 1] = g;
        data[base + 2] = b;
        data[base + 3] = 255;
      }
    }

    this.offscreenCtx.putImageData(this.imageData, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height);

    this.drawProbe(probe);
    this.drawCylinder(cylinder);

    if (options.showStreamlines) {
      this.drawStreamlines(ux, uy, obstacle, width, height);
    }

    this.drawLegend(viewMode, speedScale, vorticityScale);
    this.lastViewMode = viewMode;
  }

  drawCylinder(cylinder) {
    this.ctx.save();
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    this.ctx.beginPath();
    this.ctx.arc(
      cylinder.centerX * this.scale,
      cylinder.centerY * this.scale,
      cylinder.radius * this.scale,
      0,
      Math.PI * 2,
    );
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawProbe(probe) {
    this.ctx.save();
    this.ctx.fillStyle = '#f4f4f5';
    this.ctx.strokeStyle = '#111827';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(probe.x * this.scale, probe.y * this.scale, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawStreamlines(ux, uy, obstacle, width, height) {
    const seeds = 14;
    const xStart = 4;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    this.ctx.lineWidth = 1;

    for (let seed = 0; seed < seeds; seed += 1) {
      const y = ((seed + 1) / (seeds + 1)) * (height - 1);
      let px = xStart;
      let py = y;
      this.ctx.beginPath();
      this.ctx.moveTo(px * this.scale, py * this.scale);

      for (let step = 0; step < 170; step += 1) {
        const obstacleValue = sampleNearest(obstacle, width, height, px, py);
        if (obstacleValue) {
          break;
        }

        const u = sampleNearest(ux, width, height, px, py);
        const v = sampleNearest(uy, width, height, px, py);
        const magnitude = Math.hypot(u, v);
        if (magnitude < 1e-4) {
          break;
        }

        px += (u / magnitude) * 0.75;
        py += (v / magnitude) * 0.75;

        if (px < 0 || px >= width || py < 0 || py >= height) {
          break;
        }

        this.ctx.lineTo(px * this.scale, py * this.scale);
      }

      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawLegend(viewMode, speedScale, vorticityScale) {
    const width = this.legendCanvas.width;
    const height = this.legendCanvas.height;
    this.legendCtx.clearRect(0, 0, width, height);

    for (let x = 0; x < width; x += 1) {
      const ratio = x / (width - 1);
      const [r, g, b] = viewMode === 'vorticity'
        ? vorticityColor((ratio * 2) - 1)
        : speedColor(ratio);
      this.legendCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      this.legendCtx.fillRect(x, 0, 1, height - 16);
    }

    this.legendCtx.fillStyle = '#d4d4d8';
    this.legendCtx.font = '12px system-ui';
    this.legendCtx.textBaseline = 'bottom';

    if (viewMode === 'vorticity') {
      this.legendCtx.fillText(`-ω ${vorticityScale.toFixed(3)}`, 0, height);
      this.legendCtx.fillText('0', Math.floor(width / 2) - 4, height);
      this.legendCtx.fillText(`+ω ${vorticityScale.toFixed(3)}`, width - 60, height);
    } else {
      this.legendCtx.fillText('0', 0, height);
      this.legendCtx.fillText(`|u| ${speedScale.toFixed(3)}`, width - 55, height);
    }
  }
}
