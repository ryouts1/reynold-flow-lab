function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function sequentialColor(normalized) {
  const t = clamp01(normalized);
  const r = Math.round(16 + (240 * t));
  const g = Math.round(30 + (145 * Math.pow(t, 0.75)));
  const b = Math.round(44 + (190 * (1 - Math.pow(t, 0.9))));
  return [r, g, b];
}

function divergingColor(normalized) {
  const t = clamp01((normalized + 1) * 0.5);
  const r = Math.round(35 + (225 * t));
  const g = Math.round(38 + (170 * (1 - Math.abs((t * 2) - 1))));
  const b = Math.round(40 + (225 * (1 - t)));
  return [r, g, b];
}

function sampleNearest(field, width, height, x, y) {
  const xi = Math.max(0, Math.min(width - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
  return field[xi + (yi * width)];
}

export class FieldRenderer {
  constructor(canvas, legendCanvas, scale = 5) {
    this.canvas = canvas;
    this.legendCanvas = legendCanvas;
    this.ctx = canvas.getContext('2d');
    this.legendCtx = legendCanvas.getContext('2d');
    this.scale = scale;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this.imageData = null;
  }

  resize(width, height) {
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    this.canvas.width = width * this.scale;
    this.canvas.height = height * this.scale;
    this.imageData = this.offscreenCtx.createImageData(width, height);
  }

  render(frame, options = {}) {
    const { slice, metrics } = frame;
    const {
      width,
      height,
      obstacle,
      velocityA,
      velocityB,
      speed,
      spanwise,
      vorticity,
      probe,
    } = slice;

    if (!this.imageData || this.offscreenCanvas.width !== width || this.offscreenCanvas.height !== height) {
      this.resize(width, height);
    }

    const viewMode = options.viewMode ?? 'vorticity';
    const data = this.imageData.data;
    const speedScale = Math.max(0.04, slice.maxSpeed * 1.12, metrics.maxSpeed * 0.9);
    const vorticityScale = Math.max(0.008, slice.maxAbsVorticity * 1.12);
    const spanwiseScale = Math.max(0.001, metrics.maxSpanwiseSpeed * 1.12, slice.maxAbsSpanwise * 1.12);

    for (let index = 0; index < obstacle.length; index += 1) {
      const base = index * 4;
      if (obstacle[index]) {
        data[base] = 20;
        data[base + 1] = 20;
        data[base + 2] = 24;
        data[base + 3] = 255;
        continue;
      }

      let rgb = [0, 0, 0];
      if (viewMode === 'spanwise') {
        rgb = divergingColor(spanwise[index] / spanwiseScale);
      } else if (viewMode === 'speed') {
        rgb = sequentialColor(speed[index] / speedScale);
      } else {
        rgb = divergingColor(vorticity[index] / vorticityScale);
      }

      data[base] = rgb[0];
      data[base + 1] = rgb[1];
      data[base + 2] = rgb[2];
      data[base + 3] = 255;
    }

    this.offscreenCtx.putImageData(this.imageData, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height);

    if (options.showStreamlines) {
      this.drawStreamlines(velocityA, velocityB, obstacle, width, height);
    }

    this.drawProbe(probe);
    this.drawLegend(viewMode, speedScale, vorticityScale, spanwiseScale);
  }

  drawProbe(probe) {
    this.ctx.save();
    this.ctx.fillStyle = probe.onSlice ? '#f4f4f5' : 'rgba(244, 244, 245, 0.2)';
    this.ctx.strokeStyle = probe.onSlice ? '#111827' : 'rgba(244, 244, 245, 0.55)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(probe.x * this.scale, probe.y * this.scale, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawStreamlines(velocityA, velocityB, obstacle, width, height) {
    const seeds = Math.max(8, Math.floor(height / 6));
    const xStart = 2;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255,255,255,0.36)';
    this.ctx.lineWidth = 1;

    for (let seed = 0; seed < seeds; seed += 1) {
      const y = ((seed + 1) / (seeds + 1)) * (height - 1);
      let px = xStart;
      let py = y;
      this.ctx.beginPath();
      this.ctx.moveTo(px * this.scale, py * this.scale);

      for (let step = 0; step < 160; step += 1) {
        if (sampleNearest(obstacle, width, height, px, py)) {
          break;
        }

        const u = sampleNearest(velocityA, width, height, px, py);
        const v = sampleNearest(velocityB, width, height, px, py);
        const magnitude = Math.hypot(u, v);
        if (magnitude < 1e-5) {
          break;
        }

        px += (u / magnitude) * 0.7;
        py += (v / magnitude) * 0.7;

        if (px < 0 || px >= width || py < 0 || py >= height) {
          break;
        }

        this.ctx.lineTo(px * this.scale, py * this.scale);
      }

      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawLegend(viewMode, speedScale, vorticityScale, spanwiseScale) {
    const width = this.legendCanvas.width;
    const height = this.legendCanvas.height;
    this.legendCtx.clearRect(0, 0, width, height);

    for (let x = 0; x < width; x += 1) {
      const ratio = x / (width - 1);
      const [r, g, b] = viewMode === 'speed'
        ? sequentialColor(ratio)
        : divergingColor((ratio * 2) - 1);
      this.legendCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      this.legendCtx.fillRect(x, 0, 1, height - 16);
    }

    this.legendCtx.fillStyle = '#d4d4d8';
    this.legendCtx.font = '12px system-ui';
    this.legendCtx.textBaseline = 'bottom';

    if (viewMode === 'speed') {
      this.legendCtx.fillText('0', 0, height);
      this.legendCtx.fillText(`|u| ${speedScale.toFixed(3)}`, width - 60, height);
      return;
    }

    if (viewMode === 'spanwise') {
      this.legendCtx.fillText(`-uz ${spanwiseScale.toFixed(3)}`, 0, height);
      this.legendCtx.fillText('0', Math.floor(width / 2) - 4, height);
      this.legendCtx.fillText(`+uz ${spanwiseScale.toFixed(3)}`, width - 64, height);
      return;
    }

    this.legendCtx.fillText(`-ω ${vorticityScale.toFixed(3)}`, 0, height);
    this.legendCtx.fillText('0', Math.floor(width / 2) - 4, height);
    this.legendCtx.fillText(`+ω ${vorticityScale.toFixed(3)}`, width - 60, height);
  }
}
