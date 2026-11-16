// Panoul de detaliu: cercurile de aderență ale roților și schema bloc a unității de control (live).
import { sample, sampleAuto, fmt } from './charts.js';

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const WHEEL = ['FS', 'FD', 'SS', 'SD'];
const WHEEL_LONG = ['față-stânga', 'față-dreapta', 'spate-stânga', 'spate-dreapta'];

/** Vedere de sus a celor 4 roți cu cercul lui Kamm, forța transmisă, presiunea și alunecarea. */
export function drawWheels(canvas, run, time) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  if (!run) return;
  const ch = run.channels, s = k => sampleAuto(ch, k, time);
  const ink = css('--ink'), muted = css('--muted'), line = css('--line');
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w * 0.17, h * 0.15);   // raza vizuală pentru μ·Fz = 6000 N
  const fRef = 6000;

  // conturul caroseriei
  g.strokeStyle = line; g.lineWidth = 2;
  const bw = w * 0.2, bh = h * 0.62;
  roundRect(g, cx - bw / 2, cy - bh / 2, bw, bh, 18); g.stroke();
  g.fillStyle = muted; g.font = '11px ' + css('--sans'); g.textAlign = 'center';
  g.fillText('▲ față', cx, cy - bh / 2 + 14);

  const delta = s('delta') * Math.PI / 180;
  const pos = [[cx - w * 0.26, cy - h * 0.22], [cx + w * 0.26, cy - h * 0.22], [cx - w * 0.26, cy + h * 0.2], [cx + w * 0.26, cy + h * 0.2]];
  for (let i = 0; i < 4; i++) {
    const [x, y] = pos[i];
    const fz = s('fz' + i), mu = s('mu' + i), fx = s('fx' + i), fy = s('fy' + i);
    const p = s('p' + i), slip = s('slip' + i), st = Math.round(s('st' + i)), util = s('util' + i);
    const r = Math.max(6, R * Math.max(0, mu * fz) / fRef);
    // cercul de aderență
    g.fillStyle = util > 0.97 ? 'rgba(224,49,49,.12)' : 'rgba(28,126,214,.07)';
    g.strokeStyle = util > 0.97 ? css('--bad') : css('--accent');
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    // roata
    g.save(); g.translate(x, y); if (i < 2) g.rotate(-delta);
    let col = '#343a40';
    if (st === 1 || st === 3) col = css('--esp'); else if (st === 2) col = css('--abs'); else if (st === 4) col = css('--tcs'); else if (st === 5) col = css('--ebd'); else if (p > 2) col = css('--brake');
    g.fillStyle = col; g.fillRect(-6, -16, 12, 32);
    // forța (x înainte = în sus pe ecran, y stânga = stânga pe ecran)
    const k = r / (mu * fz || 1);
    const ax = -fy * k, ay = -fx * k;
    arrow(g, 0, 0, ax, ay, '#e8590c', 2.5);
    g.restore();

    // texte (deasupra / dedesubtul cercului, spre exteriorul vehiculului)
    const top = i < 2;
    const ty = top ? y - R - 22 : y + R + 14;
    g.textAlign = 'center';
    g.fillStyle = ink; g.font = '600 11px ' + css('--sans');
    g.fillText(`${WHEEL[i]} · ${fmt(p, 0)} bar`, x, ty);
    g.font = '11px ' + css('--mono'); g.fillStyle = css('--ink-2');
    g.fillText(`λ ${fmt(slip, 0)}%  ${fmt(util * 100, 0)}%μFz`, x, ty + 14);
    // bară de presiune
    const left = i % 2 === 0;
    const bx = left ? x - R - 14 : x + R + 8;
    g.fillStyle = line; g.fillRect(bx, y - 22, 6, 44);
    g.fillStyle = col === '#343a40' ? css('--brake') : col;
    const fr = Math.min(1, p / 120);
    g.fillRect(bx, y + 22 - 44 * fr, 6, 44 * fr);
  }
}

function arrow(g, x0, y0, x1, y1, color, width) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 2) return;
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0), hl = Math.min(9, len * 0.4);
  g.beginPath(); g.moveTo(x1, y1);
  g.lineTo(x1 - hl * Math.cos(a - 0.45), y1 - hl * Math.sin(a - 0.45));
  g.lineTo(x1 - hl * Math.cos(a + 0.45), y1 - hl * Math.sin(a + 0.45));
  g.fill();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---------------------------------------------------------------- schema bloc

const BLOCKS = [
  { id: 'sens', x: 6, y: 8, w: 92, h: 40, t: 'Senzori', v: 'sens' },
  { id: 'mon', x: 118, y: 8, w: 92, h: 40, t: 'Monitor (estimare)', v: 'mon' },
  { id: 'ref', x: 230, y: 8, w: 92, h: 40, t: 'Model referință', v: 'ref' },
  { id: 'esp', x: 118, y: 72, w: 204, h: 40, t: 'Regulator ESP – nivel 1 (moment de giratie)', v: 'esp' },
  { id: 'abs', x: 118, y: 136, w: 62, h: 34, t: 'ABS', v: '' },
  { id: 'tcs', x: 189, y: 136, w: 62, h: 34, t: 'TCS', v: '' },
  { id: 'edtc', x: 260, y: 136, w: 62, h: 34, t: 'EDTC', v: '' },
  { id: 'hyd', x: 118, y: 194, w: 97, h: 34, t: 'Modulator hidraulic', v: '' },
  { id: 'eng', x: 225, y: 194, w: 97, h: 34, t: 'Management motor', v: '' },
  { id: 'veh', x: 6, y: 194, w: 92, h: 34, t: 'Vehicul', v: '' },
];

export function buildDiagram(host) {
  const arrows = [
    ['M98,28 L118,28', 'a1'], ['M210,28 L230,28', 'a2'], ['M276,48 L276,72', 'a3'], ['M164,48 L164,72', 'a4'],
    ['M149,112 L149,136', 'a5'], ['M220,112 L220,136', 'a6'], ['M291,112 L291,136', 'a7'],
    ['M149,170 L149,194', 'a8'], ['M220,170 L220,182 L180,182 L180,194', 'a9'], ['M220,170 L220,182 L262,182 L262,194', 'a10'], ['M291,170 L291,194', 'a11'],
    ['M118,211 L98,211', 'a12'], ['M225,232 L225,240 L52,240 L52,228', 'a13'], ['M52,194 L52,48', 'a14'],
  ];
  host.innerHTML = `<svg viewBox="0 0 330 248" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" style="color: var(--muted)"/></marker></defs>
    ${arrows.map(([d, id]) => `<path id="${id}" class="arrow" d="${d}"/>`).join('')}
    ${BLOCKS.map(b => `<g class="blk" id="blk-${b.id}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6"/>
      <text x="${b.x + b.w / 2}" y="${b.y + (b.v ? 15 : b.h / 2 + 4)}" text-anchor="middle">${b.t}</text>
      ${b.v ? `<text class="val" id="val-${b.v}" x="${b.x + b.w / 2}" y="${b.y + 31}" text-anchor="middle"></text>` : ''}</g>`).join('')}
  </svg>`;
}

export function updateDiagram(host, run, time) {
  if (!run || !host.firstChild) return;
  const ch = run.channels, s = k => sampleAuto(ch, k, time);
  const esp = s('esp') > 0.5;
  const absOn = [0, 1, 2, 3].some(i => { const st = Math.round(s('st' + i)); return st === 2 || st === 3; });
  const espBrake = [0, 1, 2, 3].some(i => { const st = Math.round(s('st' + i)); return st === 1 || st === 3; });
  const tcs = s('tcs') > 0.5 || [0, 1, 2, 3].some(i => Math.round(s('st' + i)) === 4);
  const edtc = s('edtc') > 0.5;
  const engLim = s('tCmd') < s('tReq') - 30;
  const set = (id, cls, on) => host.querySelector('#blk-' + id)?.classList.toggle(cls, on);
  set('esp', 'on', esp);
  set('abs', 'on-abs', absOn || espBrake);
  set('tcs', 'on-tcs', tcs);
  set('edtc', 'on-tcs', edtc);
  set('hyd', 'on', espBrake || absOn || tcs);
  set('eng', 'on', engLim || edtc);
  const live = (id, on) => host.querySelector('#' + id)?.classList.toggle('live', on);
  live('a5', esp && espBrake || absOn); live('a6', tcs || (esp && engLim)); live('a7', edtc);
  live('a8', espBrake || absOn || tcs); live('a11', engLim || edtc); live('a9', tcs && engLim); live('a10', false);
  const txt = (id, v) => { const e = host.querySelector('#val-' + id); if (e) e.textContent = v; };
  txt('sens', `r=${fmt(s('r'), 1)}°/s ay=${fmt(s('ay'), 1)}`);
  txt('mon', `β̂=${fmt(s('betaEst'), 1)}° μ̂=${fmt(s('muEst'), 2)}`);
  txt('ref', `r_ref=${fmt(s('rRef'), 1)}°/s`);
  const mode = Math.round(s('mode'));
  txt('esp', esp ? `${mode === 1 ? 'SUPRAVIRARE' : 'SUBVIRARE'} · Mz = ${fmt(s('mz'), 0)} N·m` : 'inactiv – vehicul stabil');
}

export { WHEEL_LONG };
