export class ProbeChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = [];
  }

  setData(data) {
    this.data = data;
    this.render();
  }

  render() {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    this.ctx.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      const y = (height / 4) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }

    if (this.data.length < 2) {
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '12px system-ui';
      this.ctx.fillText('プローブ信号を待っています', 10, 18);
      return;
    }

    let min = Infinity;
    let max = -Infinity;
    for (const value of this.data) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }

    const span = Math.max(0.0001, max - min);

    this.ctx.strokeStyle = '#60a5fa';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.data.forEach((value, index) => {
      const x = (index / (this.data.length - 1)) * width;
      const y = height - (((value - min) / span) * (height - 8)) - 4;
      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    this.ctx.fillStyle = '#cbd5e1';
    this.ctx.font = '11px system-ui';
    this.ctx.fillText(`max ${max.toFixed(4)}`, 8, 14);
    this.ctx.fillText(`min ${min.toFixed(4)}`, 8, height - 6);
  }
}
