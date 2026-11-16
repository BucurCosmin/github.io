// Schema hidraulică a modulatorului ESP (configurație în X, 12 supape) – după fig. 3 din cap. „Hydraulic modulator”.
// Folosită atât în pagina „Sisteme de frânare” (moduri alese manual), cât și în simulare (stare live din ECU).

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// indicii roților din simulator: 0 FS(VL) 1 FD(VR) 2 SS(HL) 3 SD(HR)
// circuitul 1: HL + VR; circuitul 2: VL + HR
const CIRCUITS = [
  { x0: 18, wheels: [2, 1], hz: 352 },
  { x0: 402, wheels: [0, 3], hz: 408 },
];
const WNAME = ['VL · față-stânga', 'VR · față-dreapta', 'HL · spate-stânga', 'HR · spate-dreapta'];

function valve(id, x, y, label, vertical = true) {
  // supapă 2/2: dreptunghi cu simbolul de trecere (deschis) sau blocare (închis) + bobina
  return `<g class="hv" id="${id}" transform="translate(${x},${y})">
    <rect class="hv-coil" x="-25" y="-9" width="8" height="18" rx="2"/>
    <rect class="hv-body" x="-15" y="-13" width="30" height="26" rx="3"/>
    <g class="hv-open"><line x1="0" y1="-11" x2="0" y2="11"/><path d="M-4,5 L0,11 L4,5"/></g>
    <g class="hv-closed"><line x1="0" y1="-11" x2="0" y2="-3"/><line x1="-6" y1="-3" x2="6" y2="-3"/><line x1="0" y1="11" x2="0" y2="3"/><line x1="-6" y1="3" x2="6" y2="3"/></g>
    <text x="20" y="4" class="hv-lbl">${label}</text></g>`;
}

export function buildModulator(host, opts = {}) {
  const pipes = [], extras = [];
  const P = (cls, d) => pipes.push(`<path class="pipe ${cls}" d="${d}"/><path class="flow ${cls}-f" d="${d}"/>`);
  // cilindrul principal
  extras.push(`<g class="hz"><rect x="300" y="8" width="160" height="40" rx="6"/><text x="380" y="25" text-anchor="middle" class="hz-t">HZ – cilindru principal</text>
    <text x="380" y="41" text-anchor="middle" class="hz-p" id="hz-p">0 bar</text></g>`);
  // motorul pompelor (comun)
  extras.push(`<line x1="199" y1="232" x2="551" y2="232" class="shaft"/><g class="motor" id="motor"><circle cx="380" cy="232" r="17"/><text x="380" y="237" text-anchor="middle">M</text></g>`);

  CIRCUITS.forEach((c, k) => {
    const X = c.x0, usvX = X + 90, hsvX = X + 226, pumpX = X + 165, wa = X + 45, wb = X + 305;
    // HZ → USV → magistrala de înaltă presiune
    P(`hz${k}`, `M${c.hz},48 L${c.hz},70 L${usvX},70 L${usvX},92`);
    P(`hzh${k}`, `M${c.hz},70 L${hsvX},70 L${hsvX},92`);
    P(`bus${k}`, `M${usvX},118 L${usvX},150 M${wa},150 L${wb},150 M${pumpX},150 L${pumpX},216`);
    // HSV → aspirația pompei
    P(`suc${k}`, `M${hsvX},118 L${hsvX},290 L${pumpX},290 L${pumpX},248`);
    // roți
    c.wheels.forEach((w, j) => {
      const wx = j === 0 ? wa : wb, ox = j === 0 ? wx + 45 : wx - 45;
      P(`in${w}`, `M${wx},150 L${wx},185`);
      P(`wh${w}`, `M${wx},211 L${wx},392 M${wx},250 L${ox},250 L${ox},282`);
      P(`ret${w}`, `M${ox},308 L${ox},338 L${pumpX + (j === 0 ? -20 : 20)},338`);
      extras.push(valve(`iv${w}`, wx, 198, 'IV'), valve(`ov${w}`, ox, 295, 'OV'));
      extras.push(`<g class="rz" id="rz${w}"><rect x="${wx - 34}" y="392" width="68" height="34" rx="5"/>
        <text x="${wx}" y="406" text-anchor="middle" class="rz-t">RZ ${WNAME[w].split(' ')[0]}</text>
        <text x="${wx}" y="420" text-anchor="middle" class="rz-p" id="rzp${w}">0 bar</text></g>
        <text x="${wx}" y="442" text-anchor="middle" class="wname">${WNAME[w].split('· ')[1]}</text>`);
    });
    extras.push(valve(`usv${k}`, usvX, 105, 'USV'), valve(`hsv${k}`, hsvX, 105, 'HSV'));
    // pompa și acumulatorul de joasă presiune
    extras.push(`<g class="pump" id="pump${k}"><circle cx="${pumpX}" cy="232" r="16"/><path d="M${pumpX - 7},238 L${pumpX},224 L${pumpX + 7},238 Z"/>
      <text x="${pumpX + 20}" y="262" class="hv-lbl">PE</text></g>
      <g class="ac"><rect x="${pumpX - 22}" y="326" width="44" height="26" rx="4"/><text x="${pumpX}" y="343" text-anchor="middle" class="hv-lbl">AC</text></g>
      <path class="pipe ret-ac${k}" d="M${pumpX},326 L${pumpX},300"/>
      <text x="${X + 170}" y="462" text-anchor="middle" class="circ">Circuitul de frânare ${k + 1}</text>`);
  });

  host.innerHTML = `<svg viewBox="0 0 780 470" class="modulator" xmlns="http://www.w3.org/2000/svg">${pipes.join('')}${extras.join('')}</svg>
    ${opts.legend === false ? '' : `<div class="mod-legend">
      <span><i class="lg-coil"></i>bobină alimentată</span><span><i class="lg-flow"></i>circulația lichidului</span>
      <span><i class="lg-grad"></i>presiune 0 → 150 bar</span>
      <span>IV admisie (NO) · OV evacuare (NC) · USV comutare (NO) · HSV înaltă presiune (NC) · PE pompă · AC acumulator</span></div>`}`;
}

const pColor = p => {
  const k = Math.max(0, Math.min(1, p / 150));
  // albastru-gri (0 bar) → roșu închis (150 bar)
  const a = [148, 170, 196], b = [201, 42, 42];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
};

/**
 * @param state {{pmc:number, p:number[], iv:boolean[], ov:boolean[], usv:boolean[], hsv:boolean[], pump:boolean, dp?:number[]}}
 *   iv[i] = admisie închisă, ov[i] = evacuare deschisă, usv[c] = comutare închisă, hsv[c] = înaltă presiune deschisă
 */
export function updateModulator(host, s) {
  const svg = host.querySelector('svg');
  if (!svg) return;
  const q = sel => svg.querySelector(sel);
  const all = sel => svg.querySelectorAll(sel);
  const setValve = (id, open, energized) => {
    const g = q('#' + id); if (!g) return;
    g.classList.toggle('open', open); g.classList.toggle('closed', !open); g.classList.toggle('energized', energized);
  };
  const color = (cls, p) => all('.pipe.' + cls).forEach(e => e.style.stroke = pColor(p));
  const flow = (cls, on, reverse = false) => all('.flow.' + cls + '-f').forEach(e => { e.classList.toggle('on', on); e.classList.toggle('rev', reverse); });
  q('#hz-p').textContent = `${s.pmc.toFixed(0)} bar`;

  CIRCUITS.forEach((c, k) => {
    const usvClosed = s.usv[k], hsvOpen = s.hsv[k];
    setValve(`usv${k}`, !usvClosed, usvClosed);
    setValve(`hsv${k}`, hsvOpen, hsvOpen);
    const busP = usvClosed ? Math.max(s.pmc, ...c.wheels.filter(w => !s.iv[w]).map(w => s.p[w]), 0) : s.pmc;
    color(`hz${k}`, s.pmc); color(`hzh${k}`, s.pmc); color(`bus${k}`, busP);
    color(`suc${k}`, hsvOpen ? s.pmc * 0.2 : 0);
    const pumpOn = s.pump && (hsvOpen || c.wheels.some(w => s.ov[w]));
    q('#pump' + k).classList.toggle('on', pumpOn);
    flow(`suc${k}`, hsvOpen && pumpOn);
    let anyBuild = false;
    c.wheels.forEach(w => {
      const ivClosed = s.iv[w], ovOpen = s.ov[w];
      setValve(`iv${w}`, !ivClosed, ivClosed);
      setValve(`ov${w}`, ovOpen, ovOpen);
      color(`in${w}`, ivClosed ? busP : s.p[w]); color(`wh${w}`, s.p[w]); color(`ret${w}`, ovOpen ? 8 : 0);
      const dp = s.dp ? s.dp[w] : 0;
      const building = !ivClosed && dp > 0.5;
      const releasingToHz = !ivClosed && dp < -0.5 && !ovOpen;
      flow(`in${w}`, building || releasingToHz, releasingToHz);
      flow(`wh${w}`, building || ovOpen || releasingToHz, ovOpen || releasingToHz);
      flow(`ret${w}`, ovOpen);
      if (building) anyBuild = true;
      q('#rzp' + w).textContent = `${s.p[w].toFixed(0)} bar`;
      q('#rz' + w).style.setProperty('--fill', pColor(s.p[w]));
    });
    flow(`bus${k}`, anyBuild || (pumpOn && usvClosed));
    flow(`hz${k}`, anyBuild && !usvClosed);
    flow(`hzh${k}`, hsvOpen && pumpOn);
  });
  q('#motor').classList.toggle('on', !!s.pump);
}

/** Starea modulatorului pentru câteva moduri tipice (pagina didactică). */
export const MODES = {
  idle: {
    title: 'Repaus', text: 'Nicio supapă alimentată: IV deschise, OV închise, USV deschise, HSV închise. Calea hidraulică HZ → RZ este liberă – sistemul este transparent pentru șofer.',
    state: { pmc: 0, p: [0, 0, 0, 0], iv: [0, 0, 0, 0], ov: [0, 0, 0, 0], usv: [0, 0], hsv: [0, 0], pump: 0, dp: [0, 0, 0, 0] },
  },
  build: {
    title: 'Frânare normală (pasiv)', text: 'Șoferul generează presiunea în cilindrul principal; lichidul trece prin USV și IV (deschise fără curent) direct în etriere. Supapele nu sunt comutate.',
    state: { pmc: 60, p: [55, 55, 55, 55], iv: [0, 0, 0, 0], ov: [0, 0, 0, 0], usv: [0, 0], hsv: [0, 0], pump: 0, dp: [2, 2, 2, 2] },
  },
  hold: {
    title: 'ABS – menținerea presiunii', text: 'Roata față-dreapta tinde să se blocheze: supapa de admisie IV este alimentată (închisă). Presiunea din etrier rămâne constantă, deși șoferul apasă mai tare.',
    state: { pmc: 110, p: [95, 70, 60, 60], iv: [0, 1, 0, 0], ov: [0, 0, 0, 0], usv: [0, 0], hsv: [0, 0], pump: 0, dp: [1, 0, 0.6, 0.6] },
  },
  release: {
    title: 'ABS – reducerea presiunii', text: 'IV rămâne închisă, OV se deschide: lichidul din etrier trece în acumulatorul de joasă presiune AC, de unde pompa de retur PE îl trimite înapoi spre cilindrul principal. Roata se deblochează.',
    state: { pmc: 110, p: [95, 35, 60, 60], iv: [0, 1, 0, 0], ov: [0, 1, 0, 0], usv: [0, 0], hsv: [0, 0], pump: 1, dp: [0, -3, 0, 0] },
  },
  partial: {
    title: 'ESP parțial activ', text: 'Șoferul frânează, dar presiunea lui nu este suficientă pentru stabilizare. USV se închide, HSV (în două trepte – poate deschide contra presiunii mari) se deschide, iar pompa auto-amorsantă crește presiunea pe roata față-stânga peste presiunea șoferului.',
    state: { pmc: 30, p: [80, 28, 28, 28], iv: [0, 0, 0, 1], ov: [0, 0, 0, 0], usv: [0, 1], hsv: [0, 1], pump: 1, dp: [3, 0, 0, 0] },
  },
  active: {
    title: 'ESP complet activ (o singură roată)', text: 'Vehicul instabil, șoferul nu frânează: USV închisă, HSV deschisă, pompa aspiră lichid din rezervor prin cilindrul principal și construiește presiune doar pe roata aleasă (aici față-dreapta, la supravirare în viraj stânga). Celelalte roți ale circuitului au IV închisă.',
    state: { pmc: 0, p: [0, 60, 0, 0], iv: [0, 0, 1, 0], ov: [0, 0, 0, 0], usv: [1, 0], hsv: [1, 0], pump: 1, dp: [0, 3, 0, 0] },
  },
  activeRelease: {
    title: 'ESP – sfârșitul intervenției', text: 'După stabilizare OV se deschide, iar presiunea excedentară trece în acumulator; USV și HSV revin în poziția de repaus, pompa golește acumulatoarele.',
    state: { pmc: 0, p: [0, 25, 0, 0], iv: [0, 1, 0, 0], ov: [0, 1, 0, 0], usv: [0, 0], hsv: [0, 0], pump: 1, dp: [0, -3, 0, 0] },
  },
  tcs: {
    title: 'TCS – frânarea roții care patinează', text: 'La pornire, roata spate-dreapta (tracțiune spate) patinează: modulatorul frânează activ doar această roată (USV închisă, HSV deschisă în circuitul 2), transferând cuplul prin diferențial spre roata cu aderență.',
    state: { pmc: 0, p: [0, 0, 0, 35], iv: [1, 0, 0, 0], ov: [0, 0, 0, 0], usv: [0, 1], hsv: [0, 1], pump: 1, dp: [0, 0, 0, 2] },
  },
};

export function stateFromRun(run, t, sampleFn, sampleStepFn) {
  const ch = run.channels;
  const s = k => (/^(iv|ov|usv|hsv|pump)/.test(k) && sampleStepFn ? sampleStepFn : sampleFn)(ch.t, ch[k], t);
  const p = [0, 1, 2, 3].map(i => s('p' + i));
  const dp = [0, 1, 2, 3].map(i => s('p' + i) - sampleFn(ch.t, ch['p' + i], Math.max(0, t - 0.04)));
  return {
    pmc: s('pmc'), p, dp,
    iv: [0, 1, 2, 3].map(i => s('iv' + i) > 0.5), ov: [0, 1, 2, 3].map(i => s('ov' + i) > 0.5),
    usv: [0, 1].map(c => s('usv' + c) > 0.5), hsv: [0, 1].map(c => s('hsv' + c) > 0.5), pump: s('pump') > 0.5,
  };
}

export function normalizeMode(m) {
  const st = m.state;
  return { ...st, iv: st.iv.map(Boolean), ov: st.ov.map(Boolean), usv: st.usv.map(Boolean), hsv: st.hsv.map(Boolean), pump: !!st.pump };
}
