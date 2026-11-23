// Instrumente analogice de tablou (96 × 96 mm), desenate în SVG
const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

class Gauge {
  constructor(el, o) {
    this.o = Object.assign({ a0: -125, a1: 125, minor: 5, decimals: 0, zones: [], labelEvery: 1 }, o);
    const { min, max, step } = this.o;
    const s = svgEl("svg", { viewBox: "0 0 200 200", role: "img", "aria-label": o.title }, el);
    // ramă și cadran
    svgEl("rect", { x: 2, y: 2, width: 196, height: 196, rx: 10, fill: "#151719" }, s);
    svgEl("rect", { x: 9, y: 9, width: 182, height: 182, rx: 5, fill: "#fbfbf7" }, s);
    const cx = 100, cy = 112, R = 76;
    const ang = (v) => this.o.a0 + (Math.min(max, Math.max(min, v)) - min) / (max - min) * (this.o.a1 - this.o.a0);
    this.ang = ang;
    const pt = (a, r) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
    const arc = (v0, v1, r, w, color) => {
      const [x0, y0] = pt(ang(v0), r), [x1, y1] = pt(ang(v1), r);
      const large = (ang(v1) - ang(v0)) > 180 ? 1 : 0;
      svgEl("path", { d: `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`, stroke: color, "stroke-width": w, fill: "none" }, s);
    };
    for (const z of this.o.zones) arc(z.from, z.to, R - 4, 7, z.color);
    arc(min, max, R, 1.6, "#111");
    // diviziuni
    const nMaj = Math.round((max - min) / step);
    for (let i = 0; i <= nMaj; i++) {
      const v = min + i * step, a = ang(v);
      const [x0, y0] = pt(a, R), [x1, y1] = pt(a, R - 11);
      svgEl("line", { x1: x0, y1: y0, x2: x1, y2: y1, stroke: "#111", "stroke-width": 2.2 }, s);
      if (i % this.o.labelEvery === 0) {
        const [tx, ty] = pt(a, R - 22);
        const t = svgEl("text", { x: tx, y: ty + 4, "text-anchor": "middle", "font-size": (this.o.max >= 1000 ? 11 : 12.5), "font-family": "DejaVu Sans, Arial", fill: "#111" }, s);
        t.textContent = (this.o.fmt ? this.o.fmt(v) : String(+v.toFixed(2))).replace(".", ",");
      }
      if (i < nMaj) for (let k = 1; k < this.o.minor; k++) {
        const av = ang(v + k * step / this.o.minor);
        const [a0x, a0y] = pt(av, R), [a1x, a1y] = pt(av, R - 6);
        svgEl("line", { x1: a0x, y1: a0y, x2: a1x, y2: a1y, stroke: "#111", "stroke-width": 1 }, s);
      }
    }
    // inscripții
    const u = svgEl("text", { x: cx, y: cy + 34, "text-anchor": "middle", "font-size": 12, "font-weight": 700, "font-family": "DejaVu Sans, Arial", fill: "#111" }, s);
    u.textContent = o.unit;
    const tl = svgEl("text", { x: cx, y: 30, "text-anchor": "middle", "font-size": 11, "font-family": "DejaVu Sans, Arial", fill: "#444", "letter-spacing": "1" }, s);
    tl.textContent = o.title;
    // afișaj digital
    svgEl("rect", { x: 62, y: 156, width: 76, height: 22, rx: 3, fill: "#0f1a12" }, s);
    this.dig = svgEl("text", { x: 133, y: 172, "text-anchor": "end", "font-size": 14, "font-family": "DejaVu Sans Mono, monospace", fill: "#7dff9a" }, s);
    // ac indicator
    this.needle = svgEl("g", { class: "needle", style: `transform-origin:${cx}px ${cy}px` }, s);
    svgEl("path", { d: `M${cx - 2.2},${cy + 14} L${cx - 1.1},${cy - R + 6} L${cx + 1.1},${cy - R + 6} L${cx + 2.2},${cy + 14} Z`, fill: "#d1201b" }, this.needle);
    svgEl("circle", { cx, cy, r: 8, fill: "#151719" }, s);
    svgEl("circle", { cx, cy, r: 3, fill: "#666" }, s);
    this.set(min);
  }
  set(v) {
    this.needle.style.transform = `rotate(${this.ang(v)}deg)`;
    this.dig.textContent = Number(v).toFixed(this.o.decimals).replace(".", ",");
  }
}
window.Gauge = Gauge;
