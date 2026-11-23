import { MAP, CONTINENTS, BRIDGES, REGIONS, biomeAt, BIOMES, isLand } from './geography.js';
/** Cartographic renderer. Every region marker shares coordinates with the battle map. */
export class AtlasRenderer {
  constructor() {
    this.image = document.createElement('canvas');
    this.image.width = 1200;
    this.image.height = 800;
    this.paint();
  }
  paint() {
    const c = this.image.getContext('2d'),
      w = 1200,
      h = 800,
      s = w / MAP.w;
    const grad = c.createRadialGradient(660, 360, 40, 600, 400, 800);
    grad.addColorStop(0, '#25484b');
    grad.addColorStop(0.6, '#152c34');
    grad.addColorStop(1, '#07141d');
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);
    let seed = 391;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 11000; i++) {
      c.fillStyle = `rgba(150,183,179,${rnd() * 0.045})`;
      c.fillRect(rnd() * w, rnd() * h, rnd() * 30 + 1, 1);
    }
    const path = (poly) => {
      c.beginPath();
      poly.forEach(([x, y], i) => (i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s)));
      c.closePath();
    };
    for (const poly of CONTINENTS) {
      path(poly);
      c.shadowColor = '#06151b';
      c.shadowBlur = 24;
      c.shadowOffsetY = 12;
      c.fillStyle = '#746e4f';
      c.fill();
      c.shadowColor = 'transparent';
      c.shadowOffsetY = 0;
      c.lineWidth = 12;
      c.strokeStyle = '#34606155';
      c.stroke();
      c.lineWidth = 3;
      c.strokeStyle = '#a0a17c77';
      c.stroke();
    }
    c.save();
    c.beginPath();
    for (const poly of CONTINENTS) {
      poly.forEach(([x, y], i) => (i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s)));
      c.closePath();
    }
    c.clip();
    for (let y = 0; y < h; y += 3)
      for (let x = 0; x < w; x += 3) {
        const wx = x / s,
          wy = y / s,
          b = biomeAt(wx, wy),
          n =
            Math.sin(wx * 0.006 + Math.sin(wy * 0.011)) * Math.cos(wy * 0.007) +
            Math.sin(wx * 0.018 + wy * 0.013) * 0.3;
        c.fillStyle = BIOMES[b].css;
        c.fillRect(x, y, 3, 3);
        c.fillStyle = n > 0 ? `rgba(225,219,174,${n * 0.13})` : `rgba(16,35,28,${-n * 0.25})`;
        c.fillRect(x, y, 3, 3);
      }
    for (let i = 0; i < 18000; i++) {
      let x = rnd() * w,
        y = rnd() * h,
        b = biomeAt(x / s, y / s);
      c.fillStyle =
        b === 'snow' ? `rgba(231,241,240,${rnd() * 0.2})` : `rgba(24,44,28,${rnd() * 0.13})`;
      c.fillRect(x, y, rnd() * 4 + 0.5, rnd() * 3 + 0.5);
    }
    // Ridge relief: clusters rather than uniform triangle tiles.
    for (let i = 0; i < 420; i++) {
      let x = 130 + rnd() * 620,
        y = 60 + rnd() * 340,
        wx = x / s,
        wy = y / s;
      let ridge = Math.abs(wy / 3 - (450 + Math.sin((wx / 3) * 0.004) * 180));
      if (ridge > 150 || !isLand(wx, wy, 55)) continue;
      const size = 8 + rnd() * 23;
      c.fillStyle = '#1b333744';
      c.beginPath();
      c.ellipse(x + 8, y + 8, size * 1.1, size * 0.4, -0.2, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(x - size, y + size * 0.35);
      c.lineTo(x, y - size);
      c.lineTo(x + size * 0.85, y + size * 0.4);
      c.closePath();
      c.fillStyle = '#6e8585';
      c.fill();
      c.beginPath();
      c.moveTo(x, y - size);
      c.lineTo(x + size * 0.85, y + size * 0.4);
      c.lineTo(x + 2, y + 2);
      c.closePath();
      c.fillStyle = '#455e64';
      c.fill();
      c.beginPath();
      c.moveTo(x, y - size);
      c.lineTo(x - size * 0.42, y - size * 0.2);
      c.lineTo(x - 2, y - size * 0.35);
      c.lineTo(x + size * 0.35, y - size * 0.15);
      c.closePath();
      c.fillStyle = '#dde8e5';
      c.fill();
    }
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * w,
        y = rnd() * h,
        b = biomeAt(x / s, y / s);
      if (!['forest', 'grass'].includes(b) || !isLand(x / s, y / s, 50)) continue;
      if (Math.sin(x * 0.05) + Math.cos(y * 0.06) < 0.4) continue;
      c.fillStyle = rnd() > 0.5 ? '#32523e99' : '#496449aa';
      c.beginPath();
      c.arc(x, y, 1 + rnd() * 3, 0, 7);
      c.fill();
    }
    c.strokeStyle = '#e4cca03b';
    c.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      let x = 410 + rnd() * 340,
        y = 510 + rnd() * 180;
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(x + 25, y - 13, x + 40, y + 5, x + 65, y - 4);
      c.stroke();
    }
    c.restore();
    for (const b of BRIDGES) {
      c.fillStyle = '#9c9d8255';
      c.fillRect((b.x - b.w / 2) * s, (b.y - b.h / 2) * s, b.w * s, b.h * s);
      c.setLineDash([2, 3]);
      c.strokeStyle = '#c5bc8f88';
      c.strokeRect((b.x - b.w / 2) * s, (b.y - b.h / 2) * s, b.w * s, b.h * s);
      c.setLineDash([]);
    }
    c.font = 'italic 16px Georgia';
    c.textAlign = 'center';
    c.fillStyle = '#a9c7c650';
    c.fillText('THE SUNDERED SEA', 840, 480);
    c.font = 'italic 12px Georgia';
    c.fillText('NORTHERN EXPANSE', 520, 50);
    c.fillText('THE LONG TIDE', 185, 600);
    // Compass rose.
    c.save();
    c.translate(1070, 690);
    c.strokeStyle = '#c7b17b88';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, 30, 0, 7);
    c.stroke();
    for (let i = 0; i < 8; i++) {
      c.save();
      c.rotate((i * Math.PI) / 4);
      c.beginPath();
      c.moveTo(0, -43);
      c.lineTo(5, 0);
      c.lineTo(0, 10);
      c.lineTo(-5, 0);
      c.closePath();
      c.fillStyle = i % 2 ? '#7f8a7855' : '#d1bf8e88';
      c.fill();
      c.restore();
    }
    c.fillStyle = '#d1bf8e';
    c.font = '12px Georgia';
    c.fillText('N', 0, -51);
    c.restore();
    const vignette = c.createRadialGradient(600, 400, 280, 600, 400, 700);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, '#03111bcc');
    c.fillStyle = vignette;
    c.fillRect(0, 0, w, h);
  }
  draw(canvas) {
    let rect = canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    let c = canvas.getContext('2d');
    c.drawImage(this.image, 0, 0, canvas.width, canvas.height);
  }
}
