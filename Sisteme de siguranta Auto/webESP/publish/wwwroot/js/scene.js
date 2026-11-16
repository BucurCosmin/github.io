// Vedere de sus a scenei: drum, obiecte, traiectorii, vehicule cu starea roților și vectorii de forță.
import { sample, sampleAuto } from './charts.js';

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const CAR_L = 4.7, CAR_W = 1.85;

export class Scene {
  constructor(canvas) {
    this.c = canvas;
    this.cam = { mode: 'fit', cx: 0, cy: 0, scale: 6, zoom: 1 };
    this.sim = null;
    this.free = null;
    let drag = null;
    canvas.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY, cx: this.view?.cx ?? 0, cy: this.view?.cy ?? 0 }; });
    window.addEventListener('mouseup', () => drag = null);
    window.addEventListener('mousemove', e => {
      if (!drag || !this.view) return;
      const s = this.view.scale;
      this.free = { cx: drag.cx - (e.clientX - drag.x) / s, cy: drag.cy + (e.clientY - drag.y) / s, scale: s };
      this.onFree?.();
      this.redraw?.();
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0015);
      if (this.free) this.free.scale *= f;
      else this.cam.zoom = Math.min(20, Math.max(0.2, this.cam.zoom * f));
      this.redraw?.();
    }, { passive: false });
    new ResizeObserver(() => this.redraw?.()).observe(canvas);
  }

  setCamera(mode) { this.cam.mode = mode; this.free = null; this.cam.zoom = 1; }

  setData(sim) {
    this.sim = sim;
    const r = sim.road;
    // marginile drumului (normale la axă)
    const n = r.x.length;
    this.edges = { lx: [], ly: [], rx: [], ry: [], nx: [], ny: [] };
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      let dx = r.x[i1] - r.x[i0], dy = r.y[i1] - r.y[i0];
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      this.edges.nx.push(-dy); this.edges.ny.push(dx);
    }
    // limitele scenei pentru modul „ansamblu”: traiectoriile + porțiunea de drum parcursă
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const add = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const run of sim.runs) {
      const X = run.channels.x, Y = run.channels.y;
      for (let i = 0; i < X.length; i += 5) add(X[i], Y[i]);
    }
    const bx0 = x0 - 25, bx1 = x1 + 25, by0 = y0 - 25, by1 = y1 + 25;
    for (let i = 0; i < n; i++) if (r.x[i] > bx0 && r.x[i] < bx1 && r.y[i] > by0 && r.y[i] < by1) add(r.x[i], r.y[i]);
    for (const o of r.objects) add(o.x, o.y);
    const m = r.width / 2 + 6;
    this.bounds = { x0: x0 - m, x1: x1 + m, y0: y0 - m, y1: y1 + m };
    this.trailCache = new Map();
  }

  view_(w, h, time) {
    if (this.free) return this.free;
    const mode = this.cam.mode;
    if (mode === 'A' || mode === 'B') {
      const run = this.sim.runs[mode === 'A' ? 0 : 1];
      const ch = run.channels;
      return { cx: sample(ch.t, ch.x, time), cy: sample(ch.t, ch.y, time), scale: 13 * this.cam.zoom };
    }
    const b = this.bounds;
    const s = Math.min(w / (b.x1 - b.x0), h / (b.y1 - b.y0)) * this.cam.zoom;
    return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, scale: s };
  }

  render(time, opt) {
    const dpr = window.devicePixelRatio || 1;
    const w = this.c.clientWidth, h = this.c.clientHeight;
    if (!w || !h) return;
    if (this.c.width !== Math.round(w * dpr) || this.c.height !== Math.round(h * dpr)) { this.c.width = w * dpr; this.c.height = h * dpr; }
    const g = this.c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = css('--grass'); g.fillRect(0, 0, w, h);
    if (!this.sim) return;
    const v = this.view_(w, h, time);
    this.view = v;
    // transformare lume → ecran (y în sus)
    g.translate(w / 2, h / 2);
    g.scale(v.scale, -v.scale);
    g.translate(-v.cx, -v.cy);
    const px = 1 / v.scale; // un pixel în metri

    this.drawRoad(g, px);
    this.drawObjects(g, px);
    if (this.sim.road.pathX) this.drawPath(g, px);

    const runs = this.sim.runs.map((r, i) => ({ r, i, key: i === 0 ? 'A' : 'B' }))
      .filter(o => opt.show === 'both' || opt.show === o.key);
    if (opt.trail) for (const o of runs) this.drawTrail(g, o.r, time, px);
    if (opt.ghost) for (const o of runs) this.drawGhosts(g, o.r, time, px);
    for (const o of runs) this.drawCar(g, o.r, o.key, time, px, opt);

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawScale(g, w, h, v.scale);
  }

  drawRoad(g, px) {
    const r = this.sim.road, e = this.edges, n = r.x.length;
    const hw = r.width / 2, sh = r.shoulder ?? 1;
    const strip = (off0, off1, color) => {
      g.fillStyle = color; g.beginPath();
      for (let i = 0; i < n; i++) g.lineTo(r.x[i] + e.nx[i] * off0, r.y[i] + e.ny[i] * off0);
      for (let i = n - 1; i >= 0; i--) g.lineTo(r.x[i] + e.nx[i] * off1, r.y[i] + e.ny[i] * off1);
      g.closePath(); g.fill();
    };
    const mu = r.baseMu;
    const road = mu < 0.3 ? '#9fb3c4' : mu < 0.55 ? '#d5dde6' : mu < 0.85 ? '#4c535d' : css('--asphalt');
    const shoulder = mu < 0.55 ? '#e8eef4' : '#8f969e';
    strip(-hw - sh, hw + sh, shoulder);
    strip(-hw, hw, road);

    // zone cu aderență diferită
    for (const z of r.zones) {
      g.fillStyle = 'rgba(165, 216, 255, .75)';
      const x0 = Math.max(z.xMin, -1e4), x1 = Math.min(z.xMax, 1e4);
      const y0 = Math.max(z.yMin, r.y[0] - hw - 1), y1 = Math.min(z.yMax, r.y[0] + hw + 1);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      this.text(g, `${z.label}  μ = ${z.mu.toLocaleString('ro-RO')}`, x0 + 6, (y0 + y1) / 2, px, '#1864ab', 12, 'left');
    }

    const line = (off, dash, color, width) => {
      g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash);
      g.beginPath();
      for (let i = 0; i < n; i++) g.lineTo(r.x[i] + e.nx[i] * off, r.y[i] + e.ny[i] * off);
      g.stroke(); g.setLineDash([]);
    };
    const mark = mu < 0.55 ? 'rgba(255,255,255,.55)' : '#f1f3f5';
    line(-hw + 0.25, [], mark, 0.15);
    line(hw - 0.25, [], mark, 0.15);
    for (let k = 1; k < r.lanes; k++) line(-hw + r.width * k / r.lanes, [3, 6], mark, 0.13);
  }

  drawObjects(g, px) {
    for (const o of this.sim.road.objects) {
      g.save(); g.translate(o.x, o.y); g.rotate(o.heading || 0);
      if (o.kind === 'cone') {
        g.fillStyle = '#ff6b00'; g.beginPath(); g.arc(0, 0, 0.28, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 0.11, 0, Math.PI * 2); g.fill();
      } else if (o.kind === 'car') {
        g.fillStyle = '#868e96'; this.rrect(g, -2.25, -0.9, 4.5, 1.8, 0.35); g.fill();
        g.fillStyle = '#495057'; this.rrect(g, -0.2, -0.75, 1.3, 1.5, 0.2); g.fill();
        g.fillStyle = '#ff8787'; g.fillRect(-2.25, -0.85, 0.12, 0.35); g.fillRect(-2.25, 0.5, 0.12, 0.35);
      } else if (o.kind === 'obstacle') {
        for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#fff' : '#e03131'; g.fillRect(-0.6, -1.5 + k * 0.5, 1.2, 0.5); }
        this.text(g, 'obstacol', 0, 2.2, px, '#c92a2a', 12);
      }
      g.restore();
    }
  }

  drawPath(g, px) {
    const r = this.sim.road;
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2 * px; g.setLineDash([4 * px, 6 * px]);
    g.beginPath();
    for (let i = 0; i < r.pathX.length; i++) g.lineTo(r.pathX[i], r.pathY[i]);
    g.stroke(); g.setLineDash([]);
  }

  drawTrail(g, run, time, px) {
    const ch = run.channels, n = ch.t.length;
    const last = Math.min(n - 1, Math.floor(time / run.sampleTime));
    g.strokeStyle = run.color; g.lineWidth = 2.5 * px; g.globalAlpha = .9;
    g.beginPath();
    for (let i = 0; i <= last; i++) g.lineTo(ch.x[i], ch.y[i]);
    g.stroke(); g.globalAlpha = 1;
    // amprentele roților spate cu derapaj puternic (urme de pneu)
    g.fillStyle = 'rgba(20,20,20,.35)';
    for (let i = 0; i <= last; i += 2) {
      for (const w of [2, 3]) {
        if ((ch['util' + w][i] ?? 0) < 0.97) continue;
        const psi = ch.psi[i], yy = w === 2 ? 0.78 : -0.78, xx = -1.55;
        g.fillRect(ch.x[i] + xx * Math.cos(psi) - yy * Math.sin(psi) - .1, ch.y[i] + xx * Math.sin(psi) + yy * Math.cos(psi) - .1, .2, .2);
      }
    }
  }

  drawGhosts(g, run, time, px) {
    const ch = run.channels;
    const step = Math.round(0.5 / run.sampleTime);
    const last = Math.min(ch.t.length - 1, Math.floor(time / run.sampleTime));
    g.globalAlpha = .28;
    for (let i = 0; i < last; i += step) {
      const k = Math.max(1, 30 / (CAR_L / px));
      g.save(); g.translate(ch.x[i], ch.y[i]); g.rotate(ch.psi[i]); g.scale(k, k);
      g.strokeStyle = run.color; g.lineWidth = 1.5 * px; g.fillStyle = '#fff';
      this.rrect(g, -CAR_L / 2, -CAR_W / 2, CAR_L, CAR_W, 0.4); g.fill(); g.stroke();
      g.restore();
    }
    g.globalAlpha = 1;
  }

  drawCar(g, run, key, time, px, opt) {
    const ch = run.channels, s = name => sampleAuto(ch, name, time);
    const veh = this.sim.info.vehicle;
    const x = s('x'), y = s('y'), psi = s('psi'), delta = s('delta') * Math.PI / 180;
    const espOn = s('esp') > 0.5;
    const k = Math.max(1, 30 / (CAR_L / px)); // simbol mărit când scena e foarte micșorată
    g.save(); g.translate(x, y); g.rotate(psi); g.scale(k, k);

    // aura de intervenție ESP
    if (espOn) {
      g.fillStyle = css('--esp'); g.globalAlpha = .22;
      this.rrect(g, -CAR_L / 2 - .5, -CAR_W / 2 - .5, CAR_L + 1, CAR_W + 1, 0.9); g.fill(); g.globalAlpha = 1;
    }
    // caroserie
    g.fillStyle = run.color; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1 * px;
    this.rrect(g, -CAR_L / 2, -CAR_W / 2, CAR_L, CAR_W, 0.45); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)';
    this.rrect(g, 0.15, -CAR_W / 2 + 0.2, 1.1, CAR_W - 0.4, 0.2); g.fill();      // parbriz
    g.fillStyle = 'rgba(0,0,0,.2)';
    this.rrect(g, -1.6, -CAR_W / 2 + 0.25, 0.8, CAR_W - 0.5, 0.2); g.fill();     // lunetă
    this.text(g, key, -0.55, 0, px, '#fff', 15, 'center', true);

    // roți
    const pos = [[veh.a, veh.trackFront / 2], [veh.a, -veh.trackFront / 2], [-veh.b, veh.trackFront / 2], [-veh.b, -veh.trackFront / 2]];
    for (let i = 0; i < 4; i++) {
      const [wx, wy] = pos[i];
      const p = s('p' + i), st = Math.round(s('st' + i));
      g.save(); g.translate(wx, wy); if (i < 2) g.rotate(delta);
      let col = '#1d1d1d';
      if (st === 1 || st === 3) col = css('--esp');
      else if (st === 2) col = css('--abs');
      else if (st === 4) col = css('--tcs');
      else if (st === 5) col = css('--ebd');
      else if (p > 2) col = css('--brake');
      g.fillStyle = col;
      g.fillRect(-0.33, -0.12, 0.66, 0.24);
      if (p > 2) { // intensitatea frânării
        g.strokeStyle = col; g.lineWidth = Math.min(0.25, 0.04 + p / 600);
        g.strokeRect(-0.42, -0.2, 0.84, 0.4);
      }
      g.restore();

      if (opt.forces) {
        // forța la roată (în sistemul roții → al vehiculului)
        const fx = s('fx' + i), fy = s('fy' + i), d = i < 2 ? delta : 0;
        const bx = fx * Math.cos(d) - fy * Math.sin(d), by = fx * Math.sin(d) + fy * Math.cos(d);
        const k = 1 / 2200; // m / N
        this.arrow(g, wx, wy, wx + bx * k, wy + by * k, '#ffd43b', 2.2 * px);
      }
    }
    g.restore();

    if (opt.vel) {
      // vectorul vitezei (direcția reală de deplasare) și axa longitudinală – unghiul dintre ele = β
      const vx = s('vx'), vy = s('vy');
      const vk = 0.18;
      const ang = psi + Math.atan2(vy, Math.max(0.5, Math.abs(vx)));
      const sp = Math.hypot(vx, vy);
      g.setLineDash([3 * px, 3 * px]);
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.5 * px;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(psi) * (CAR_L * 0.9 + sp * vk * 0.6), y + Math.sin(psi) * (CAR_L * 0.9 + sp * vk * 0.6)); g.stroke();
      g.setLineDash([]);
      this.arrow(g, x, y, x + Math.cos(ang) * (CAR_L * 0.6 + sp * vk), y + Math.sin(ang) * (CAR_L * 0.6 + sp * vk), '#2f9e44', 3 * px);
    }
  }

  arrow(g, x0, y0, x1, y1, color, width) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    if (len < 0.05) return;
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const a = Math.atan2(dy, dx), hl = Math.min(0.6, len * 0.4);
    g.beginPath(); g.moveTo(x1, y1);
    g.lineTo(x1 - hl * Math.cos(a - 0.4), y1 - hl * Math.sin(a - 0.4));
    g.lineTo(x1 - hl * Math.cos(a + 0.4), y1 - hl * Math.sin(a + 0.4));
    g.closePath(); g.fill();
  }

  rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  text(g, str, x, y, px, color, size = 12, align = 'center', bold = false) {
    g.save(); g.translate(x, y); g.scale(px, -px);
    g.fillStyle = color; g.font = `${bold ? '700 ' : ''}${size}px ${css('--sans')}`;
    g.textAlign = align; g.textBaseline = 'middle';
    g.fillText(str, 0, 0); g.restore();
  }

  drawScale(g, w, h, scale) {
    const target = 120 / scale;
    const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(v => v >= target * 0.6) || 500;
    const len = nice * scale;
    const x = w - len - 16, y = h - 18;
    g.strokeStyle = css('--ink'); g.fillStyle = css('--ink'); g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x, y); g.lineTo(x + len, y); g.lineTo(x + len, y - 5); g.stroke();
    g.font = '12px ' + css('--sans'); g.textAlign = 'center';
    g.fillText(`${nice} m`, x + len / 2, y - 7);
  }
}
