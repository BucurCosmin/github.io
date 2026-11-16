// Bibliotecă minimală de grafice pe canvas (fără dependențe externe – aplicația rulează și offline).
// Fiecare grafic are un strat static (curbe, axe) și un strat dinamic (cursorul de timp).

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function niceTicks(min, max, count = 5) {
  if (!isFinite(min) || !isFinite(max)) return [0];
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

export const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v)) ? '–'
  : v.toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d });

export class LineChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{series: Array, yLabel?: string, yMin?: number, yMax?: number, symmetric?: boolean, bands?: Array, xLabel?: string, xMax?: number}} cfg
   */
  constructor(canvas, cfg, onSeek) {
    this.c = canvas;
    this.cfg = cfg;
    this.onSeek = onSeek;
    this.cursor = null;
    this.static = document.createElement('canvas');
    this.pad = { l: 48, r: 10, t: 8, b: 22 };
    const seek = e => {
      if (!this.onSeek || !this.sx) return;
      const r = this.c.getBoundingClientRect();
      const x = e.clientX - r.left;
      this.onSeek(this.invX(x));
    };
    let drag = false;
    canvas.addEventListener('mousedown', e => { drag = true; seek(e); });
    window.addEventListener('mouseup', () => drag = false);
    canvas.addEventListener('mousemove', e => { if (drag) seek(e); });
    this.ro = new ResizeObserver(() => this.render());
    this.ro.observe(canvas);
  }

  destroy() { this.ro.disconnect(); }

  setData(cfg) { this.cfg = cfg; this.render(); }

  range() {
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const s of this.cfg.series) {
      const t = s.t, y = s.y;
      if (!t || !y) continue;
      if (this.cfg.xy) { for (let i = 0; i < t.length; i++) { if (t[i] < xmin) xmin = t[i]; if (t[i] > xmax) xmax = t[i]; } }
      else { xmin = Math.min(xmin, t[0]); xmax = Math.max(xmax, t[t.length - 1]); }
      for (let i = 0; i < y.length; i++) {
        const v = y[i];
        if (v === null || Number.isNaN(v) || !isFinite(v)) continue;
        if (v < ymin) ymin = v;
        if (v > ymax) ymax = v;
      }
    }
    for (const gl of this.cfg.guides || []) { ymin = Math.min(ymin, gl.y); ymax = Math.max(ymax, gl.y); }
    if (this.cfg.xMax !== undefined) xmax = this.cfg.xMax;
    if (this.cfg.xMin !== undefined) xmin = this.cfg.xMin;
    if (!isFinite(ymin)) { ymin = -1; ymax = 1; }
    if (this.cfg.yMin !== undefined) ymin = Math.min(ymin, this.cfg.yMin);
    if (this.cfg.yMax !== undefined) ymax = Math.max(ymax, this.cfg.yMax);
    if (this.cfg.clampMin !== undefined) ymin = Math.max(ymin, this.cfg.clampMin);
    if (this.cfg.clampMax !== undefined) ymax = Math.min(ymax, this.cfg.clampMax);
    if (this.cfg.symmetric) { const m = Math.max(Math.abs(ymin), Math.abs(ymax)); ymin = -m; ymax = m; }
    const padY = (ymax - ymin) * 0.08 || 1;
    return { xmin: isFinite(xmin) ? xmin : 0, xmax: isFinite(xmax) ? xmax : 1, ymin: ymin - padY, ymax: ymax + padY };
  }

  invX(px) { return this.xr.xmin + (px - this.pad.l) / (this.w - this.pad.l - this.pad.r) * (this.xr.xmax - this.xr.xmin); }

  render() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.c.clientWidth, h = this.c.clientHeight;
    if (!w || !h) return;
    this.w = w; this.h = h;
    for (const cv of [this.c, this.static]) { cv.width = w * dpr; cv.height = h * dpr; }
    const g = this.static.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const r = this.range();
    this.xr = r;
    const { l, r: pr, t, b } = this.pad;
    const sx = v => l + (v - r.xmin) / (r.xmax - r.xmin) * (w - l - pr);
    const sy = v => t + (1 - (v - r.ymin) / (r.ymax - r.ymin)) * (h - t - b);
    this.sx = sx; this.sy = sy;

    const ink2 = css('--ink-2'), line = css('--line'), muted = css('--muted');
    g.font = '11px ' + css('--sans');
    g.lineWidth = 1;
    // grilă
    g.strokeStyle = line; g.fillStyle = muted; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const v of niceTicks(r.ymin, r.ymax, 4)) {
      const y = Math.round(sy(v)) + .5;
      g.beginPath(); g.moveTo(l, y); g.lineTo(w - pr, y); g.stroke();
      g.fillText(fmt(v, Math.abs(v) < 10 && v % 1 !== 0 ? 1 : 0), l - 6, y);
    }
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (const v of niceTicks(r.xmin, r.xmax, 8)) {
      const x = Math.round(sx(v)) + .5;
      g.beginPath(); g.moveTo(x, t); g.lineTo(x, h - b); g.stroke();
      g.fillText(fmt(v, v % 1 ? 1 : 0), x, h - b + 5);
    }
    // linia zero
    if (r.ymin < 0 && r.ymax > 0) { g.strokeStyle = ink2; g.globalAlpha = .45; g.beginPath(); g.moveTo(l, sy(0)); g.lineTo(w - pr, sy(0)); g.stroke(); g.globalAlpha = 1; }

    // linii de referință orizontale (praguri)
    for (const gl of this.cfg.guides || []) {
      g.strokeStyle = gl.color; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(l, sy(gl.y)); g.lineTo(w - pr, sy(gl.y)); g.stroke(); g.setLineDash([]);
      if (gl.label) { g.fillStyle = gl.color; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(gl.label, l + 4, sy(gl.y) - 2); }
    }
    // benzi (ex. domeniul permis ±β_lim)
    for (const band of this.cfg.bands || []) {
      g.fillStyle = band.color; g.globalAlpha = band.alpha ?? .12;
      g.beginPath();
      const tt = band.t;
      for (let i = 0; i < tt.length; i += 2) g.lineTo(sx(tt[i]), sy(band.hi[i]));
      for (let i = tt.length - 1; i >= 0; i -= 2) g.lineTo(sx(tt[i]), sy(band.lo[i]));
      g.closePath(); g.fill(); g.globalAlpha = 1;
    }
    // zone de activitate (ex. ESP activ)
    for (const span of this.cfg.spans || []) {
      g.fillStyle = span.color; g.globalAlpha = .10;
      g.fillRect(sx(span.t0), t, Math.max(1, sx(span.t1) - sx(span.t0)), h - t - b);
      g.globalAlpha = 1;
    }

    g.save();
    g.beginPath(); g.rect(l, t, w - l - pr, h - t - b); g.clip();
    for (const s of this.cfg.series) {
      if (!s.t || !s.y) continue;
      g.strokeStyle = s.color; g.lineWidth = s.width ?? 1.8;
      g.setLineDash(s.dash || []);
      g.globalAlpha = s.alpha ?? 1;
      g.beginPath();
      let pen = false;
      const step = Math.max(1, Math.floor(s.t.length / (w * 1.5)));
      for (let i = 0; i < s.t.length; i += step) {
        const v = s.y[i];
        if (v === null || Number.isNaN(v) || !isFinite(v)) { pen = false; continue; }
        const x = sx(s.t[i]), y = sy(v);
        if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; }
      }
      g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
    }
    g.restore();
    g.strokeStyle = line; g.strokeRect(l + .5, t + .5, w - l - pr - 1, h - t - b - 1);
    this.drawCursor();
  }

  setCursor(time) { if (this.cfg.xy) return; this.cursor = time; this.drawCursor(); }

  drawCursor() {
    if (!this.w) return;
    const dpr = window.devicePixelRatio || 1;
    const g = this.c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.c.width, this.c.height);
    g.drawImage(this.static, 0, 0);
    if (this.cursor === null || !this.sx) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x = this.sx(Math.min(this.cursor, this.xr.xmax));
    g.strokeStyle = css('--ink'); g.globalAlpha = .55; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, this.pad.t); g.lineTo(x, this.h - this.pad.b); g.stroke(); g.globalAlpha = 1;
    // punctele curente pe fiecare serie
    for (const s of this.cfg.series) {
      if (!s.t || !s.y || s.noDot) continue;
      const v = sample(s.t, s.y, this.cursor);
      if (v === null || Number.isNaN(v)) continue;
      g.fillStyle = s.color;
      g.beginPath(); g.arc(x, this.sy(v), 3, 0, Math.PI * 2); g.fill();
    }
  }
}

/** Valoarea eșantionului anterior (pentru canale discrete: stări, faze, coduri). */
export function sampleStep(t, y, time) {
  if (!t || !t.length || !y) return null;
  if (time <= t[0]) return y[0];
  let lo = 0, hi = t.length - 1;
  if (time >= t[hi]) return y[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= time) lo = m; else hi = m; }
  return y[lo];
}

const DISCRETE = /^(st\d|ph\d|iv\d|ov\d|usv\d|hsv\d|esp|mode|tcs|edtc|ebd|gma|pump)$/;
/** Eșantionare: interpolare pentru mărimi continue, treaptă pentru cele discrete. */
export function sampleAuto(ch, key, time) {
  return DISCRETE.test(key) ? sampleStep(ch.t, ch[key], time) : sample(ch.t, ch[key], time);
}

/** Interpolare liniară pe un canal eșantionat uniform sau neuniform. */
export function sample(t, y, time) {
  if (!t || !t.length) return null;
  if (time <= t[0]) return y[0];
  if (time >= t[t.length - 1]) return y[y.length - 1];
  let lo = 0, hi = t.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= time) lo = m; else hi = m; }
  const a = y[lo], b = y[hi];
  if (a === null || b === null || Number.isNaN(a) || Number.isNaN(b)) return a;
  return a + (b - a) * (time - t[lo]) / (t[hi] - t[lo]);
}
