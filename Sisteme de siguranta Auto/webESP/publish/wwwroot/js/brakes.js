// Secțiunea „Sisteme de frânare”: modulatorul hidraulic, ciclul ABS, distribuția forței de frânare (EBD),
// funcțiile automate de frânare (HBA, HFC, HRB, CDP, HHC, HDC, CDD, BDW), stabilitatea direcțională și SBC.
// Conținut după K. Reif (ed.), Automotive Mechatronics, cap. „Automatic brake functions”, „Hydraulic modulator”, „SBC”.
import { LineChart, sample, fmt } from './charts.js';
import { buildModulator, updateModulator, MODES, normalizeMode } from './hydraulics.js';

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
const num = a => Float32Array.from(a, v => typeof v === 'number' ? v : NaN);

const PAGES = [
  ['intro', 'Frânele – instrumentul ESP', 'arhitectură, funcții'],
  ['modulator', 'Modulatorul hidraulic', '12 supape, moduri de lucru'],
  ['abs', 'Ciclul de reglare ABS', 'praguri, faze, viteza de referință'],
  ['ebd', 'Distribuția forței de frânare', 'ideală, fixă, supapă, EBD'],
  ['functions', 'Funcții automate de frânare', 'HBA, HFC, HRB, CDP, HHC, HDC, CDD, BDW'],
  ['stability', 'Stabilitate direcțională și SBC', 'giratie + β, brake-by-wire'],
];

let ctx = null;

export function renderBrakes(host, api) {
  ctx = { api, charts: {} };
  host.innerHTML = `
    <nav class="brakes-nav">${PAGES.map(([id, t, s], i) => `<button data-p="${id}" class="${i ? '' : 'on'}">${t}<small>${s}</small></button>`).join('')}</nav>
    <div class="bpages">
      ${pageIntro()}${pageModulator()}${pageAbs()}${pageEbd()}${pageFunctions()}${pageStability()}
    </div>`;
  host.querySelectorAll('.brakes-nav button').forEach(b => b.addEventListener('click', () => show(host, b.dataset.p)));
  host.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => show(host, b.dataset.goto)));
  host.querySelectorAll('[data-scenario]').forEach(b => b.addEventListener('click', () => api.openScenario(b.dataset.scenario)));
  initModulator(host);
  show(host, 'intro');
}

function show(host, id) {
  host.querySelectorAll('.brakes-nav button').forEach(b => b.classList.toggle('on', b.dataset.p === id));
  host.querySelectorAll('.bpage').forEach(p => p.classList.toggle('on', p.id === 'bp-' + id));
  window.scrollTo({ top: 0 });
  if (id === 'abs' && !ctx.absLoaded) { ctx.absLoaded = true; initAbs(host); }
  if (id === 'ebd' && !ctx.ebdLoaded) { ctx.ebdLoaded = true; initEbd(host); }
  if (id === 'functions' && !ctx.fnLoaded) { ctx.fnLoaded = true; initFunctions(host); }
  setTimeout(() => Object.values(ctx.charts).flat().forEach(c => c?.render?.()), 30);
}

// =================================================================== 1. intro
function pageIntro() {
  return `<section class="bpage" id="bp-intro">
  <div><h2>Frânele – instrumentul cu care ESP „virează” vehiculul</h2>
  <p class="lead">ESP nu are actuatoare proprii pentru direcție: el acționează prin <b>frâne</b> (și prin motor). De aceea performanța ESP
  depinde direct de sistemul electronic de frânare – de modulatorul hidraulic, de regulatoarele de alunecare și de funcțiile care au
  crescut în jurul lor. Inițial ABS doar împiedica blocarea roților pentru a păstra vehiculul manevrabil la frânarea de urgență; astăzi
  frâna electronică distribuie și forța de frânare între punți (EBD) și, prin capacitatea ESP de a genera presiune independent de pedală,
  permite o serie întreagă de intervenții active.</p></div>
  <div class="bgrid even">
    <div class="panel"><h3>Arhitectura funcțiilor (fig. 1)</h3>${svgArchitecture()}
      <p class="small">Funcțiile de asistență (HBA, CDP, HHC, HDC, CDD, HFC, HRB, BDW) și ACC (prin CAN) cer o decelerare sau o forță de frânare;
      managementul decelerării / opririi le coordonează cu distribuția forței de frânare, apoi cu ABS/TCS/VDC (ESP) la nivelul cuplului de
      frânare al fiecărei roți. Modelul hidraulic estimează presiunile din etriere.</p></div>
    <div class="panel"><h3>De ce contează pentru ESP</h3>
      <ul>
        <li><b>Presiune fără pedală</b> – pompa auto-amorsantă și supapele USV/HSV permit frânarea activă a unei singure roți (moment de giratie).</li>
        <li><b>Modulare rapidă și fină</b> – supapele de admisie de generația 8 lucrează ca supape de reglare (nu doar deschis/închis): confort, zgomot redus, precizie.</li>
        <li><b>Senzor de presiune</b> – doar sistemele ESP îl au; măsoară cererea șoferului, necesară în intervențiile „parțial active”.</li>
        <li><b>Regulatoare de alunecare</b> – ESP nu comandă direct presiuni, ci <i>alunecări-țintă</i> executate de ABS/TCS.</li>
        <li><b>Modelul hidraulic</b> – presiunea din etrier nu se măsoară; este calculată din istoricul comenzilor supapelor.</li>
      </ul>
      <div class="ctrl-row">
        <button class="primary" data-goto="modulator">Modulatorul hidraulic →</button>
        <button class="primary" data-goto="abs">Ciclul ABS →</button>
        <button class="primary" data-goto="functions">Funcții automate →</button>
      </div>
    </div>
  </div>
  <div class="panel"><h3>Funcțiile sistemului electronic de frânare</h3>
    <table class="valve-table"><tr><th>Funcție</th><th>Ce face</th><th>Senzori suplimentari</th><th>Siguranță / confort</th></tr>
      <tr><td>EBD – distribuția electronică a forței de frânare</td><td>înlocuiește limitatorul mecanic; închide supapa de admisie spate când roțile spate alunecă mai mult decât cele față</td><td>–</td><td>funcție standard</td></tr>
      <tr><td>HBA – asistența la frânarea de urgență</td><td>recunoaște frânarea de panică și crește presiunea până la limita de blocare</td><td>senzorul de presiune HZ</td><td>siguranță</td></tr>
      <tr><td>CDP – decelerarea controlată pentru frâna de parcare</td><td>frânează până la oprire, la cererea șoferului (EPB), cu ESP activ</td><td>comutator frână de parcare</td><td>siguranță</td></tr>
      <tr><td>HHC – asistența la pornirea în rampă</td><td>menține presiunea până la 2 s la pornirea în pantă</td><td>senzor de înclinare</td><td>confort</td></tr>
      <tr><td>HDC – controlul coborârii pantelor</td><td>menține automat o viteză redusă la coborâre (pante până la 50%)</td><td>buton HDC</td><td>confort</td></tr>
      <tr><td>CDD – decelerare pentru sistemele de asistență</td><td>realizează decelerarea cerută de ACC</td><td>(ACC)</td><td>confort</td></tr>
      <tr><td>HFC – compensarea fadingului</td><td>crește presiunea când decelerația maximă nu este atinsă deși șoferul apasă puternic</td><td>temperatura ambiantă</td><td>siguranță</td></tr>
      <tr><td>HRB – amplificarea presiunii spate</td><td>crește presiunea spate până la blocare când puntea față este în ABS</td><td>–</td><td>siguranță</td></tr>
      <tr><td>BDW – ștergerea discurilor</td><td>impulsuri mici de presiune pe ploaie, imperceptibile</td><td>ștergătoare / senzor de ploaie</td><td>siguranță</td></tr>
    </table>
    <p class="small">Majoritatea funcțiilor folosesc senzorii existenți ai frânei electronice; unele necesită senzori suplimentari (fig. 2 din curs).</p>
  </div></section>`;
}

function svgArchitecture() {
  const box = (x, y, w, h, t, cls = '') => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" class="arch ${cls}"/>
    ${t.split('\n').map((l, i, a) => `<text x="${x + w / 2}" y="${y + h / 2 + 4 + (i - (a.length - 1) / 2) * 14}" text-anchor="middle" font-size="12">${l}</text>`).join('')}</g>`;
  const ar = (d) => `<path d="${d}" stroke="var(--muted)" stroke-width="1.5" fill="none" marker-end="url(#aa)"/>`;
  return `<svg viewBox="0 0 520 300" style="width:100%">
    <defs><marker id="aa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="var(--muted)"/></marker></defs>
    <style>.arch{fill:var(--panel-2);stroke:var(--line);stroke-width:1.5}.arch.k{fill:color-mix(in srgb,var(--accent) 12%,var(--panel));stroke:var(--accent)}text{fill:var(--ink)}</style>
    ${box(10, 30, 70, 40, 'ACC')}
    ${box(120, 10, 110, 170, 'HBA\nCDP\nHHC\nHDC\nCDD\nHFC\nHRB\nBDW', 'k')}
    ${box(290, 20, 210, 50, 'Managementul decelerării /\nal opririi')}
    ${box(290, 100, 210, 40, 'Distribuția forței de frânare')}
    ${box(290, 200, 210, 60, 'Coordonarea cuplului de\nfrânare pe roți – ABS · TCS · VDC', 'k')}
    ${box(120, 230, 110, 40, 'Model hidraulic')}
    ${ar('M80,50 L120,50')}<text x="88" y="44" font-size="10" fill="var(--muted)">CAN</text>
    ${ar('M230,45 L290,45')}${ar('M395,70 L395,100')}${ar('M395,140 L395,200')}
    <text x="400" y="88" font-size="10" fill="var(--muted)">forță de frânare</text><text x="400" y="178" font-size="10" fill="var(--muted)">cuplu de frânare pe roată</text>
    ${ar('M290,240 L230,250')}${ar('M230,240 L290,230')}
    <text x="232" y="290" font-size="10" fill="var(--muted)">ESP</text>
  </svg>`;
}

// =================================================================== 2. modulator
function pageModulator() {
  return `<section class="bpage" id="bp-modulator">
  <div><h2>Modulatorul hidraulic</h2>
  <p class="lead">Modulatorul face legătura hidraulică dintre cilindrul principal (HZ) și cilindrii de roată (RZ) și este componenta centrală a
  frânei electronice: transformă comenzile unității de control în presiuni, cu ajutorul supapelor electromagnetice. Se deosebesc sistemele
  care doar <i>modulează</i> presiunea creată de șofer (ABS) și cele care pot <i>genera</i> presiune automat (TCS, ESP). Din motive legale,
  toate sunt în variantă cu două circuite.</p></div>
  <div class="bgrid">
    <div class="panel"><h3>Schema ESP – configurație în X (fig. 3)</h3><div id="modHost"></div></div>
    <div class="panel"><h3>Moduri de lucru</h3>
      <div class="mode-list" id="modeList">${Object.entries(MODES).map(([k, m], i) => `<button data-m="${k}" class="${i ? '' : 'on'}">${m.title}</button>`).join('')}</div>
      <div class="mode-desc" id="modeDesc"></div>
      <div class="ctrl-row" style="margin-top:10px"><label class="check"><input type="checkbox" id="modCycle"> parcurge automat modurile</label></div>
    </div>
  </div>
  <div class="bgrid even">
    <div class="panel"><h3>Starea supapelor în fiecare mod (roata reglată)</h3>
      <table class="valve-table">
        <tr><th>Mod</th><th>IV (NO)</th><th>OV (NC)</th><th>USV (NO)</th><th>HSV (NC)</th><th>Pompă</th></tr>
        <tr><td>Frânare normală / creștere</td><td class="o">deschisă</td><td class="c">închisă</td><td class="o">deschisă</td><td class="c">închisă</td><td>–</td></tr>
        <tr><td>Menținere (ABS)</td><td class="c">închisă ⚡</td><td class="c">închisă</td><td class="o">deschisă</td><td class="c">închisă</td><td>–</td></tr>
        <tr><td>Reducere (ABS)</td><td class="c">închisă ⚡</td><td class="o">deschisă ⚡</td><td class="o">deschisă</td><td class="c">închisă</td><td>da (retur)</td></tr>
        <tr><td>ESP parțial activ</td><td class="o">deschisă</td><td class="c">închisă</td><td class="c">închisă ⚡</td><td class="o">deschisă ⚡</td><td>da</td></tr>
        <tr><td>ESP complet activ</td><td class="o">deschisă*</td><td class="c">închisă</td><td class="c">închisă ⚡</td><td class="o">deschisă ⚡</td><td>da</td></tr>
      </table>
      <p class="small">⚡ – bobina alimentată. NO / NC – deschisă / închisă fără curent. * Roțile care nu trebuie frânate în același circuit au IV închisă.
      HSV este realizată în două trepte: prima se deschide prin forța magnetică, a doua prin diferența de arii hidraulice – astfel poate deschide
      calea de aspirație a pompei chiar contra presiunii mari create de șofer (intervenție parțial activă).</p></div>
    <div class="panel"><h3>Numărul de supape</h3>
      <table class="valve-table">
        <tr><th>Sistem</th><th>Supape</th><th>Observații</th></tr>
        <tr><td>ABS 3 canale</td><td>6</td><td>IV + OV pe fiecare roată față, o pereche pentru puntea spate (select-low – roata cu alunecare mai mare dictează presiunea punții)</td></tr>
        <tr><td>ABS 4 canale</td><td>8</td><td>o pereche IV/OV pe fiecare roată – control individual (circuite II sau X)</td></tr>
        <tr><td>TCS, circuite II</td><td>10</td><td>+ supapă de comutare și supapă de admisie pe puntea motoare</td></tr>
        <tr><td>TCS, circuite X</td><td>12</td><td>+ supapă de comutare și de admisie pe fiecare circuit</td></tr>
        <tr><td>ESP</td><td>12</td><td>indiferent de configurație; supapele de admisie ale TCS înlocuite cu HSV (comută la Δp &gt; 0,1 MPa); pompe auto-amorsante; senzor de presiune integrat</td></tr>
      </table>
      <h3 style="margin-top:14px">Evoluție</h3>
      <p class="small">ABS2S (1978, prima serie) folosea supape 3/3: o singură supapă pe roată cu trei poziții (creștere – fără curent; menținere – la jumătate de
      curent; reducere – la curent maxim), cu comandă electrică scumpă și mecanică complexă. ABS5 și ABS8 folosesc perechi de supape 2/2 (admisie +
      evacuare) – soluție mai ieftină. Masa modulatorului a scăzut de la 6 200 g (ABS 2) la 3 800 g (ABS 5.0), 2 600 g (ABS 5.3) și sub 2 000 g
      (ABS 8, 2001 – sistem complet modular, rezistent la imersie), în timp ce puterea de calcul a crescut.</p>
      ${svgMass()}
    </div>
  </div></section>`;
}

function svgMass() {
  const d = [['ABS 2', 6200], ['ABS 5.0', 3800], ['ABS 5.3', 2600], ['ABS 8', 1900]];
  return `<svg viewBox="0 0 360 120" style="width:100%">${d.map(([n, m], i) => {
    const h = m / 6200 * 80;
    return `<rect x="${20 + i * 85}" y="${95 - h}" width="50" height="${h}" rx="4" fill="var(--accent)" opacity="${0.45 + i * 0.15}"/>
      <text x="${45 + i * 85}" y="${90 - h}" text-anchor="middle" font-size="11" fill="var(--ink)">${m === 1900 ? '< 2 000' : m.toLocaleString('ro-RO')} g</text>
      <text x="${45 + i * 85}" y="110" text-anchor="middle" font-size="11" fill="var(--muted)">${n}</text>`;
  }).join('')}</svg>`;
}

function initModulator(host) {
  const mh = host.querySelector('#modHost');
  buildModulator(mh);
  const set = k => {
    host.querySelectorAll('#modeList button').forEach(b => b.classList.toggle('on', b.dataset.m === k));
    host.querySelector('#modeDesc').textContent = MODES[k].text;
    updateModulator(mh, normalizeMode(MODES[k]));
  };
  host.querySelectorAll('#modeList button').forEach(b => b.addEventListener('click', () => set(b.dataset.m)));
  set('idle');
  let timer = null;
  host.querySelector('#modCycle').addEventListener('change', e => {
    clearInterval(timer);
    if (e.target.checked) {
      const keys = Object.keys(MODES); let i = 0;
      timer = setInterval(() => { i = (i + 1) % keys.length; set(keys[i]); }, 3500);
    }
  });
}

// =================================================================== 3. ciclul ABS
function pageAbs() {
  return `<section class="bpage" id="bp-abs">
  <div><h2>Ciclul de reglare ABS</h2>
  <p class="lead">O roată frânată, modelul de pneu al simulatorului și un modulator cu supape 2/2 a căror curgere depinde de diferența de presiune.
  Logica clasică folosește <b>pragurile de accelerație a roții</b> (−a, +a, +A) și un <b>prag de alunecare</b> λ₁ față de viteza de referință,
  care nu se măsoară, ci se estimează din vârfurile vitezei roții. Fazele: 1 – creștere, 2 – menținere, 3 – reducere, 4 – menținere la presiune mică,
  5 – creștere rapidă, 7 – creștere în trepte (pulsuri ale supapei de admisie).</p></div>
  <div class="panel"><div class="ctrl-row">
    <div class="field"><label>Viteză inițială <output id="ab-v-o"></output></label><input type="range" id="ab-v" min="30" max="160" step="5" value="100"></div>
    <div class="field"><label>μ inițial <output id="ab-mu-o"></output></label><input type="range" id="ab-mu" min="0.1" max="1.1" step="0.05" value="1"></div>
    <div class="field"><label>μ după salt <output id="ab-mu2-o"></output></label><input type="range" id="ab-mu2" min="0.1" max="1.1" step="0.05" value="1">
      <div class="mu-presets"><button data-abp="1,1">uscat</button><button data-abp="0.3,0.3">zăpadă</button><button data-abp="1,0.2">uscat → gheață</button><button data-abp="0.2,1">gheață → uscat</button></div></div>
    <div class="field"><label>Momentul saltului <output id="ab-tj-o"></output></label><input type="range" id="ab-tj" min="0.5" max="6" step="0.25" value="1.5"></div>
    <div class="field"><label>Prag −a <output id="ab-a-o"></output></label><input type="range" id="ab-a" min="0.8" max="3" step="0.1" value="1.7"></div>
    <div class="field"><label>Prag λ₁ <output id="ab-l-o"></output></label><input type="range" id="ab-l" min="0.04" max="0.25" step="0.01" value="0.1"></div>
    <button class="primary" id="ab-run">▶ Calculează</button>
  </div>
  <div class="kpis" id="ab-kpi" style="margin-top:10px"></div></div>
  <div class="panel">
    <div class="bplay"><button id="ab-play">▶</button><input type="range" id="ab-scrub" min="0" max="1000" value="0"><span class="mono" id="ab-time">0,00 s</span>
      <select id="ab-rate"><option value="0.05">0,05×</option><option value="0.1" selected>0,1×</option><option value="0.25">0,25×</option><option value="1">1×</option></select></div>
    <div class="mini-valves" id="ab-valves" style="margin-top:8px"></div>
  </div>
  <div class="charts" id="ab-charts"></div></section>`;
}

const PHASE = { 0: ['fără ABS', '#adb5bd'], 1: ['1 creștere', '#e03131'], 2: ['2 menținere', '#f59f00'], 3: ['3 reducere', '#1c7ed6'],
  4: ['4 menținere', '#fab005'], 5: ['5 creștere rapidă', '#c2255c'], 7: ['7 creștere în trepte', '#e8590c'] };

function initAbs(host) {
  const ids = ['v', 'mu', 'mu2', 'tj', 'a', 'l'];
  const out = () => {
    host.querySelector('#ab-v-o').textContent = host.querySelector('#ab-v').value + ' km/h';
    for (const k of ['mu', 'mu2']) host.querySelector(`#ab-${k}-o`).textContent = fmt(+host.querySelector('#ab-' + k).value, 2);
    host.querySelector('#ab-tj-o').textContent = fmt(+host.querySelector('#ab-tj').value, 2) + ' s';
    host.querySelector('#ab-a-o').textContent = fmt(+host.querySelector('#ab-a').value, 1) + ' g';
    host.querySelector('#ab-l-o').textContent = fmt(+host.querySelector('#ab-l').value * 100, 0) + '%';
  };
  ids.forEach(k => host.querySelector('#ab-' + k).addEventListener('input', out)); out();
  host.querySelectorAll('[data-abp]').forEach(b => b.addEventListener('click', () => {
    const [m1, m2] = b.dataset.abp.split(',');
    host.querySelector('#ab-mu').value = m1; host.querySelector('#ab-mu2').value = m2; out(); run();
  }));
  const play = { t: 0, on: false, end: 1, last: null };
  const run = async () => {
    const o = {
      speedKmh: +host.querySelector('#ab-v').value, mu: +host.querySelector('#ab-mu').value, mu2: +host.querySelector('#ab-mu2').value,
      jumpTime: +host.querySelector('#ab-mu').value === +host.querySelector('#ab-mu2').value ? 99 : +host.querySelector('#ab-tj').value,
      thresholdDecel: +host.querySelector('#ab-a').value, slipThreshold: +host.querySelector('#ab-l').value,
    };
    const res = await post('api/brakes/abs-cycle', o);
    res.runs.forEach(r => Object.keys(r.channels).forEach(k => r.channels[k] = num(r.channels[k])));
    ctx.abs = res;
    const [A, B] = res.runs;
    const S = (r, k) => r.summary[k];
    host.querySelector('#ab-kpi').innerHTML = [
      ['Distanța de oprire', `${fmt(S(A, 'stopDistance'), 1)} → ${fmt(S(B, 'stopDistance'), 1)} m`],
      ['Decelerația medie', `${fmt(S(A, 'meanDecelG'), 2)} → ${fmt(S(B, 'meanDecelG'), 2)} g`],
      ['Rezerva de ghidare laterală (medie)', `${fmt(S(A, 'lateralReserve'), 0)}% → ${fmt(S(B, 'lateralReserve'), 0)}%`],
      ['Cicluri ABS', fmt(S(B, 'cycles'), 0)],
    ].map(([k, v], i) => `<div class="kpi" style="border-color:${B.color}"><div class="k">${k}${i < 3 ? ' (fără → cu ABS)' : ''}</div><div class="v">${v}</div></div>`).join('');
    buildAbsCharts(host, res, o);
    play.end = Math.max(...res.runs.map(r => r.channels.t[r.channels.t.length - 1]));
    play.t = 0; setT(0);
  };
  const setT = t => {
    play.t = Math.max(0, Math.min(play.end, t));
    host.querySelector('#ab-scrub').value = play.t / play.end * 1000;
    host.querySelector('#ab-time').textContent = fmt(play.t, 2) + ' s';
    (ctx.charts.abs || []).forEach(c => c.setCursor?.(play.t));
    const B = ctx.abs?.runs[1]; if (!B) return;
    const s = k => sample(B.channels.t, B.channels[k], play.t);
    const ph = Math.round(s('phase'));
    const [pn, pc] = PHASE[ph] || ['–', '#999'];
    host.querySelector('#ab-valves').innerHTML = `<b>Cu ABS:</b>
      <span class="mv" style="background:${pc};color:#fff;border-color:${pc}">faza ${pn}</span>
      <span class="mv ${s('iv') > 0.5 ? 'on' : ''}">IV ${s('iv') > 0.5 ? 'închisă ⚡' : 'deschisă'}</span>
      <span class="mv ${s('ov') > 0.5 ? 'on' : ''}">OV ${s('ov') > 0.5 ? 'deschisă ⚡' : 'închisă'}</span>
      <span class="mv ${s('pump') > 0.5 ? 'on' : ''}">pompă ${s('pump') > 0.5 ? 'pornită' : 'oprită'}</span>
      <span class="mono">v = ${fmt(s('v'), 1)} km/h · v<sub>roată</sub> = ${fmt(s('vw'), 1)} · p = ${fmt(s('p'), 1)} bar · λ = ${fmt(s('slip'), 1)}% · a<sub>roată</sub> = ${fmt(s('aw'), 2)} g · μ = ${fmt(s('mu'), 2)}</span>`;
  };
  host.querySelector('#ab-run').addEventListener('click', run);
  host.querySelector('#ab-scrub').addEventListener('input', e => { play.on = false; host.querySelector('#ab-play').textContent = '▶'; setT(e.target.value / 1000 * play.end); });
  host.querySelector('#ab-play').addEventListener('click', e => { play.on = !play.on; if (play.t >= play.end) play.t = 0; e.target.textContent = play.on ? '❚❚' : '▶'; play.last = null; });
  const loop = ts => {
    if (play.on && play.last != null) {
      setT(play.t + (ts - play.last) / 1000 * +host.querySelector('#ab-rate').value);
      if (play.t >= play.end) { play.on = false; host.querySelector('#ab-play').textContent = '▶'; }
    }
    play.last = ts; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  ctx.setAbsT = setT;
  run();
}

function chartBox(host, title, legend, height = 200) {
  const div = document.createElement('div');
  div.className = 'chart';
  div.innerHTML = `<div class="ct"><span>${title}</span><span class="cl">${legend.map(([c, l, dash]) =>
    `<span><i style="background:${dash ? `repeating-linear-gradient(90deg,${c} 0 4px,transparent 4px 7px)` : c}"></i>${l}</span>`).join('')}</span></div><canvas style="height:${height}px"></canvas>`;
  host.appendChild(div);
  return div.querySelector('canvas');
}

function buildAbsCharts(host, res, o) {
  (ctx.charts.abs || []).forEach(c => c.destroy());
  const box = host.querySelector('#ab-charts'); box.innerHTML = '';
  const [A, B] = res.runs, a = A.channels, b = B.channels;
  const seek = t => ctx.setAbsT(t);
  const ink = css('--ink'), mut = css('--muted');
  const charts = [];
  charts.push(new LineChart(chartBox(box, 'Viteze [km/h]', [[ink, 'vehicul (cu ABS)'], [B.color, 'roată cu ABS'], [mut, 'viteza de referință estimată', 1], [A.color, 'roată fără ABS']]), {
    series: [
      { t: b.t, y: b.v, color: ink, width: 2 }, { t: b.t, y: b.vw, color: B.color, width: 1.6 },
      { t: b.t, y: b.vref, color: mut, dash: [5, 4], width: 1.3 }, { t: a.t, y: a.vw, color: A.color, width: 1.4, alpha: .8 }],
  }, seek));
  charts.push(new LineChart(chartBox(box, 'Presiunea în etrier [bar]', [[B.color, 'cu ABS'], [A.color, 'fără ABS'], [ink, 'cilindru principal', 1]]), {
    series: [{ t: b.t, y: b.p, color: B.color, width: 2 }, { t: a.t, y: a.p, color: A.color, width: 1.4, alpha: .7 }, { t: b.t, y: b.pmc, color: ink, dash: [5, 4], width: 1.2 }],
  }, seek));
  charts.push(new LineChart(chartBox(box, 'Accelerația periferică a roții [g] – praguri −a, +a, +A', [[B.color, 'cu ABS']]), {
    series: [{ t: b.t, y: b.aw, color: B.color, width: 1.6 }], clampMin: -6, clampMax: 8,
    guides: [{ y: -o.thresholdDecel, color: '#e03131', label: '−a' }, { y: 1, color: '#2b8a3e', label: '+a' }, { y: 6, color: '#7048e8', label: '+A' }],
  }, seek));
  charts.push(new LineChart(chartBox(box, 'Alunecarea la frânare λ [%]', [[B.color, 'cu ABS'], [A.color, 'fără ABS']]), {
    series: [{ t: b.t, y: b.slip, color: B.color, width: 1.8 }, { t: a.t, y: a.slip, color: A.color, width: 1.4, alpha: .8 }], clampMin: -5, clampMax: 105,
    guides: [{ y: o.slipThreshold * 100, color: '#e03131', label: 'λ₁' }],
  }, seek));
  // banda fazelor
  const strip = document.createElement('div'); strip.className = 'chart';
  const tEnd = b.t[b.t.length - 1];
  let segs = '', start = 0, cur = b.phase[0];
  for (let i = 1; i <= b.t.length; i++) {
    if (i === b.t.length || b.phase[i] !== cur) {
      const w = ((i === b.t.length ? tEnd : b.t[i]) - b.t[start]) / tEnd * 100;
      segs += `<i style="width:${w}%;background:${(PHASE[cur] || ['', '#ccc'])[1]}" title="${(PHASE[cur] || [''])[0]}"></i>`;
      if (i < b.t.length) { start = i; cur = b.phase[i]; }
    }
  }
  strip.innerHTML = `<div class="ct"><span>Fazele ciclului ABS (în timp)</span><span class="cl">${Object.values(PHASE).slice(1).map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</span></div>
    <div class="phase-strip" style="margin-left:0">${segs}</div>
    <div class="small muted">Zoom: folosiți redarea la 0,05× – fazele unui ciclu durează câteva zeci de milisecunde.</div>`;
  box.appendChild(strip);
  charts.push(new LineChart(chartBox(box, 'Punctul de funcționare pe curba μ–λ (F<sub>x</sub>/F<sub>z</sub> în funcție de λ)', [[B.color, 'cu ABS'], [A.color, 'fără ABS']], 220), {
    xy: true, xMin: 0, xMax: 100,
    series: [{ t: a.slip, y: a.muUsed, color: A.color, width: 1.2, alpha: .6, noDot: true }, { t: b.slip, y: b.muUsed, color: B.color, width: 1.2, noDot: true }],
    yMin: 0,
  }));
  charts.push(new LineChart(chartBox(box, 'Rezerva de ghidare laterală [%] – forța laterală la α = 3° față de roata nefrânată', [[B.color, 'cu ABS'], [A.color, 'fără ABS']]), {
    series: [{ t: b.t, y: b.lat, color: B.color, width: 1.6 }, { t: a.t, y: a.lat, color: A.color, width: 1.6 }], yMin: 0, yMax: 100,
  }, seek));
  charts.push(new LineChart(chartBox(box, 'Distanța parcursă [m]', [[B.color, 'cu ABS'], [A.color, 'fără ABS']]), {
    series: [{ t: b.t, y: b.x, color: B.color, width: 2 }, { t: a.t, y: a.x, color: A.color, width: 2 }],
  }, seek));
  ctx.charts.abs = charts;
}

// =================================================================== 4. EBD
function pageEbd() {
  return `<section class="bpage" id="bp-ebd">
  <div><h2>Distribuția forței de frânare și EBD</h2>
  <p class="lead">Legislația cere ca sistemul de frânare să asigure o decelerare de până la 0,83 g cu comportament stabil în orice manevră. Stabilitatea
  cere ca roțile spate să nu se blocheze înaintea celor față – deci forța de frânare spate trebuie să rămână sub <b>distribuția ideală</b>, care
  depinde de decelerare (transferul de sarcină) și de încărcare.</p></div>
  <div class="bgrid">
    <div class="panel"><h3>Diagrama de distribuție (forța pe puntea spate în funcție de forța pe puntea față)</h3>
      <canvas id="eb-chart" style="height:440px;width:100%"></canvas>
      <div class="mod-legend" id="eb-legend"></div></div>
    <div class="panel"><h3>Parametri</h3>
      <div class="field"><label>Încărcătură (vehicul încărcat) <output id="eb-load-o"></output></label><input type="range" id="eb-load" min="0" max="600" step="25" value="400"></div>
      <div class="field"><label>μ pentru dreptele de blocare <output id="eb-mu-o"></output></label><input type="range" id="eb-mu" min="0.2" max="1.1" step="0.05" value="0.9"></div>
      <div class="field"><label>Supapă de limitare: presiune de comutare <output id="eb-k-o"></output></label><input type="range" id="eb-k" min="10" max="60" step="2" value="30"></div>
      <div class="field"><label>Supapă: panta după comutare <output id="eb-s-o"></output></label><input type="range" id="eb-s" min="0.1" max="0.8" step="0.05" value="0.3"></div>
      <div class="field"><label>Prag EBD (diferența de utilizare a aderenței) <output id="eb-t-o"></output></label><input type="range" id="eb-t" min="0.01" max="0.1" step="0.005" value="0.03"></div>
      <div class="kpis" id="eb-kpi"></div>
      <p class="small">Distribuția fixă a vehiculului din simulator (2/3 față, 1/3 spate) intersectează distribuția ideală în punctul P, la o
      decelerare mai mică decât 0,83 g – exact ca în fig. 2 din curs. Peste P, fără limitator, roțile spate s-ar bloca primele.</p>
      <button class="primary" data-scenario="ebd-braking">▶ Vezi efectul în simulare (scenariul 10)</button>
    </div>
  </div>
  <div class="bgrid even">
    <div class="panel"><h3>Cum funcționează EBD</h3>
      <p>Unitatea de control calculează continuu diferența de alunecare dintre roțile față și spate. Dacă, la frânare, raportul depășește un
      prag de stabilitate, <b>supapa de admisie a roții spate se închide</b> – presiunea nu mai crește. Dacă șoferul apasă mai tare, alunecarea
      roților față crește, diferența scade, iar supapa se redeschide; presiunea spate crește din nou. Procesul se repetă, iar caracteristica
      ia aspectul „în trepte” (curba 3), care aproximează distribuția ideală. Pentru EBD se folosesc doar supapele spate ale ABS;
      motorul pompei de retur rămâne nealimentat.</p></div>
    <div class="panel"><h3>Avantaje</h3><ul>
      <li>stabilitate optimă pentru orice încărcare, în viraj, la urcare/coborâre și în orice stare a transmisiei;</li>
      <li>nu mai sunt necesare limitatoarele sau supapele de reducere convenționale;</li>
      <li>solicitare termică mai mică a frânelor față și uzură uniformă a plăcuțelor față/spate;</li>
      <li>decelerare mai bună la aceeași forță pe pedală; distribuție constantă pe toată durata de viață;</li>
      <li>modificări minime ale componentelor ABS existente.</li></ul>
      <p class="small">Frânarea convențională: distribuție fixă (curba 2) – sub curba ideală, nu exploatează potențialul punții spate, mai ales cu
      vehiculul încărcat; supapa de limitare (curba 3) – câștig important descărcat, mic încărcat; supapele dependente de sarcină sau de decelerare
      îmbunătățesc situația, dar cu mecanică și hidraulică complexe.</p></div>
  </div></section>`;
}

function initEbd(host) {
  const chart = new LineChart(host.querySelector('#eb-chart'), { series: [], xy: true });
  ctx.charts.ebd = [chart];
  const out = () => {
    host.querySelector('#eb-load-o').textContent = host.querySelector('#eb-load').value + ' kg';
    host.querySelector('#eb-mu-o').textContent = fmt(+host.querySelector('#eb-mu').value, 2);
    host.querySelector('#eb-k-o').textContent = host.querySelector('#eb-k').value + ' bar';
    host.querySelector('#eb-s-o').textContent = fmt(+host.querySelector('#eb-s').value, 2);
    host.querySelector('#eb-t-o').textContent = fmt(+host.querySelector('#eb-t').value, 3);
  };
  let pending = null;
  const run = async () => {
    out();
    const r = await post('api/brakes/distribution', {
      loadKg: +host.querySelector('#eb-load').value, mu: +host.querySelector('#eb-mu').value,
      kneePressure: +host.querySelector('#eb-k').value, valveSlope: +host.querySelector('#eb-s').value, ebdThreshold: +host.querySelector('#eb-t').value,
    });
    const c = r.info.curves;
    const L = (o, color, label, opt = {}) => ({ t: num(o.x), y: num(o.y), color, label, noDot: true, width: 2, ...opt });
    const pairs = arr => ({ x: arr.map(v => v[0]), y: arr.map(v => v[1]) });
    const series = [
      L(c.idealUnladen, '#2b8a3e', '1 ideală – descărcat', { width: 2.6 }),
      L(c.idealLaden, '#2b8a3e', '1 ideală – încărcat', { dash: [6, 4] }),
      L(c.fixed, '#868e96', '2 distribuție fixă'),
      L(c.valve, '#7048e8', '3 cu supapă de limitare', { dash: [3, 3] }),
      L(c.ebd, '#1c7ed6', 'EBD (în trepte)', { width: 2.4 }),
      L(c.z083, '#e03131', 'z = 0,83 g', { dash: [8, 4], width: 1.2 }),
      L(pairs(c.lockFront), '#f08c00', `blocare față (μ = ${fmt(+host.querySelector('#eb-mu').value, 2)})`, { width: 1.2, dash: [2, 3] }),
      L(pairs(c.lockRear), '#c2255c', 'blocare spate', { width: 1.2, dash: [2, 3] }),
    ];
    const w = r.info.weightKn;
    chart.setData({ series, xy: true, xMin: 0, xMax: Math.ceil(w * 0.95), yMin: 0, yMax: w * 0.42, clampMax: w * 0.45 });
    host.querySelector('#eb-legend').innerHTML = series.map(s => `<span><i style="background:${s.dash ? `repeating-linear-gradient(90deg,${s.color} 0 4px,transparent 4px 7px)` : s.color}"></i>${s.label}</span>`).join('')
      + '<span>axa x: forța de frânare față [kN] · axa y: forța de frânare spate [kN]</span>';
    host.querySelector('#eb-kpi').innerHTML = `
      <div class="kpi"><div class="k">Punct critic P (descărcat)</div><div class="v">${fmt(r.info.criticalDecelUnladen, 2)} g</div></div>
      <div class="kpi"><div class="k">Punct critic (încărcat)</div><div class="v">${fmt(r.info.criticalDecelLaden, 2)} g</div></div>
      <div class="kpi"><div class="k">Pondere spate fixă</div><div class="v">${fmt(r.info.rearShare * 100, 0)}%</div></div>
      <div class="kpi"><div class="k">Greutate descărcat / încărcat</div><div class="v">${fmt(r.info.weightKn, 1)} / ${fmt(r.info.ladenWeightKn, 1)} kN</div></div>`;
  };
  for (const id of ['load', 'mu', 'k', 's', 't'])
    host.querySelector('#eb-' + id).addEventListener('input', () => { out(); clearTimeout(pending); pending = setTimeout(run, 120); });
  run();
}

// =================================================================== 5. funcții automate
function pageFunctions() {
  return `<section class="bpage" id="bp-functions">
  <div><h2>Funcții automate de frânare</h2>
  <p class="lead">Funcții care lucrează împreună cu ESP (unele și doar cu ABS/TCS) și folosesc, în mare parte, senzorii existenți. Unele cresc
  confortul, altele siguranța – frânarea automată în urgență scurtează distanța de oprire. Fiecare funcție este simulată cu un model
  longitudinal cu două punți (transfer de sarcină, ABS ideal, pantă).</p></div>
  <div class="panel"><div class="fn-cards" id="fnCards"></div></div>
  <div class="bgrid">
    <div class="panel"><h3 id="fnTitle"></h3><p id="fnDesc"></p><div class="charts" id="fnCharts"></div></div>
    <div class="panel"><h3>Parametri</h3><div id="fnParams"></div><div class="kpis" id="fnKpi" style="margin-top:10px"></div></div>
  </div></section>`;
}

const FN_PARAMS = {
  speed: ['Viteză inițială', 30, 160, 5, 'km/h'],
  mu: ['Coeficient de aderență μ', 0.1, 1.1, 0.05, ''],
  fade: ['Frecare plăcuțe (fading)', 0.3, 1.0, 0.05, '× normal'],
  slope: ['Panta', 2, 50, 1, '%'],
  target: ['Viteza HDC', 5, 35, 1, 'km/h'],
  interval: ['Intervalul de ștergere BDW', 2, 15, 1, 's'],
};
const FN_DEFAULTS = { hba: { speed: 100, mu: 1 }, hfc: { speed: 100, mu: 1, fade: 0.5 }, hrb: { speed: 100, mu: 1 }, cdp: { speed: 80, mu: 0.8 },
  hhc: { slope: 15, mu: 0.8 }, hdc: { slope: 28, mu: 0.6, target: 8 }, cdd: { speed: 90, mu: 1 }, bdw: { speed: 90, mu: 0.7, interval: 6 } };

async function initFunctions(host) {
  const list = await fetch('api/brakes/functions').then(r => r.json());
  ctx.fnList = list;
  host.querySelector('#fnCards').innerHTML = list.map(f => `<button data-f="${f.id}"><b>${f.name}</b><span>${f.title.replace(/\(.*\)/, '')}</span></button>`).join('');
  host.querySelectorAll('#fnCards button').forEach(b => b.addEventListener('click', () => selectFn(host, b.dataset.f)));
  selectFn(host, 'hba');
}

function selectFn(host, id) {
  const f = ctx.fnList.find(x => x.id === id);
  host.querySelectorAll('#fnCards button').forEach(b => b.classList.toggle('on', b.dataset.f === id));
  host.querySelector('#fnTitle').textContent = f.title;
  host.querySelector('#fnDesc').textContent = f.description;
  const d = FN_DEFAULTS[id];
  host.querySelector('#fnParams').innerHTML = f.params.map(p => {
    const [l, mn, mx, st, u] = FN_PARAMS[p];
    return `<div class="field"><label>${l} <output id="fp-${p}-o">${d[p]} ${u}</output></label><input type="range" id="fp-${p}" min="${mn}" max="${mx}" step="${st}" value="${d[p]}"></div>`;
  }).join('') + `<button class="primary" id="fnRun">▶ Calculează</button>`;
  let pend = null;
  f.params.forEach(p => host.querySelector('#fp-' + p).addEventListener('input', e => {
    host.querySelector(`#fp-${p}-o`).textContent = `${(+e.target.value).toLocaleString('ro-RO')} ${FN_PARAMS[p][4]}`;
    clearTimeout(pend); pend = setTimeout(() => runFn(host, id, f), 200);
  }));
  host.querySelector('#fnRun').addEventListener('click', () => runFn(host, id, f));
  runFn(host, id, f);
}

async function runFn(host, id, f) {
  const prm = Object.fromEntries(f.params.map(p => [p, +host.querySelector('#fp-' + p).value]));
  const r = await post('api/brakes/function/' + id, prm);
  r.runs.forEach(run => Object.keys(run.channels).forEach(k => run.channels[k] = num(run.channels[k])));
  (ctx.charts.fn || []).forEach(c => c.destroy());
  const box = host.querySelector('#fnCharts'); box.innerHTML = '';
  const charts = [];
  const leg = r.runs.map(x => [x.color, x.label]);
  const ser = (key, opt = {}) => r.runs.filter(x => x.channels[key]).map(x => ({ t: x.channels.t, y: x.channels[key], color: x.color, width: 2, ...opt }));
  const add = (title, series, cfg = {}, legend = leg) => charts.push(new LineChart(chartBox(box, title, legend), { series, ...cfg }));
  const ink = css('--ink');
  switch (id) {
    case 'hba':
      add('Presiunea de frânare [bar] – cf. fig. 1 (șofer obișnuit, antrenat, cu asistență)', ser('p'));
      add('Viteza [km/h]', ser('v')); add('Distanța de frânare [m]', ser('x'));
      add('Decelerația [g]', ser('z'), { yMin: 0 });
      break;
    case 'hfc':
      add('Presiunea în etriere [bar] (linie punctată: cilindrul principal)', [...ser('p'), { t: r.runs[0].channels.t, y: r.runs[0].channels.pmc, color: ink, dash: [5, 4], width: 1.2 }]);
      add('Presiunea în etrier în funcție de presiunea din HZ (forța pe pedală) – cf. fig. 5', r.runs.map(x => ({ t: x.channels.pmc, y: x.channels.p, color: x.color, width: 2, noDot: true })), { xy: true });
      add('Decelerația [g]', ser('z'), { yMin: 0 }); add('Distanța de frânare [m]', ser('x'));
      break;
    case 'hrb':
      add('Presiunea [bar]: față (continuu) și spate (punctat)', [...ser('p'), ...ser('pr', { dash: [5, 4] })]);
      add('Forțele de frânare pe punți [kN]: față (continuu), spate (punctat)', [...ser('ffr'), ...ser('frr', { dash: [5, 4] })]);
      add('Decelerația [g]', ser('z'), { yMin: 0 }); add('Distanța de frânare [m]', ser('x'));
      break;
    case 'cdp':
      add('Decelerația [g]', ser('z'), { yMin: 0 }); add('Viteza [km/h]', ser('v'));
      add('Forța de frânare [kN]: față (continuu), spate (punctat)', [...ser('ffr'), ...ser('frr', { dash: [5, 4] })]);
      add('Distanța [m]', ser('x'));
      break;
    case 'hhc':
      add('Poziția vehiculului [cm] (negativ = rulare înapoi)', ser('x'));
      add('Presiunea în etriere [bar] (punctat: cilindrul principal)', [...ser('p'), { t: r.runs[0].channels.t, y: r.runs[0].channels.pmc, color: ink, dash: [5, 4], width: 1.2 }]);
      add('Forța de tracțiune vs. componenta greutății pe pantă [kN]', [{ t: r.runs[0].channels.t, y: r.runs[0].channels.drive, color: '#2b8a3e', width: 2 }, { t: r.runs[0].channels.t, y: r.runs[0].channels.grade, color: '#e03131', dash: [6, 4], width: 1.5 }],
        {}, [['#2b8a3e', 'tracțiune'], ['#e03131', 'm·g·sin θ']]);
      add('Viteza [km/h]', ser('v'));
      break;
    case 'hdc':
      add('Viteza [km/h] (zone hașurate: roțile pierd contactul cu solul)', [...ser('v'), { t: r.runs[1].channels.t, y: r.runs[1].channels.target, color: ink, dash: [5, 4], width: 1 }],
        { spans: airSpans(r.runs[0]) });
      add('Presiunea de frânare HDC [bar]', ser('p'));
      break;
    case 'cdd': {
      const c = r.runs[0].channels;
      add('Decelerația cerută de ACC vs. realizată [m/s²]', [{ t: c.t, y: c.aReq, color: ink, dash: [5, 4], width: 1.5 }, { t: c.t, y: c.a, color: r.runs[0].color, width: 2 }], {}, [[ink, 'cerută (intrare)'], [r.runs[0].color, 'realizată (ieșire)']]);
      add('Presiunea în etriere [bar]', ser('p')); add('Viteza [km/h]', ser('v'));
      break;
    }
    case 'bdw':
      add('Pelicula de apă pe disc [%]', ser('wet'), { yMin: 0, yMax: 100 });
      add('Presiunea de frânare [bar] (impulsuri BDW ≈ 2 bar)', ser('p'));
      add('Decelerația la frânarea de urgență [g]', ser('z'), { yMin: 0, xMin: r.info.emergencyTime - 0.5 });
      break;
  }
  ctx.charts.fn = charts;
  const K = { stopDistance: ['Distanța de oprire', 'm', 1], stopTime: ['Timpul de oprire', 's', 2], rollback: ['Rulare înapoi', 'cm', 1], maxSpeed: ['Viteza maximă', 'km/h', 1],
    rmsError: ['Eroarea RMS', 'm/s²', 3], responseTime: ['Timp până la 0,75·μ·g', 's', 2], activation: ['Activare la', 's', 2], rearLocked: ['Roți spate blocate', '', 0] };
  host.querySelector('#fnKpi').innerHTML = r.runs.map(x => Object.entries(x.summary).filter(([k, v]) => K[k] && v >= 0).map(([k, v]) =>
    `<div class="kpi" style="border-color:${x.color}"><div class="k">${x.label} – ${K[k][0]}</div><div class="v">${k === 'rearLocked' ? (v ? 'da' : 'nu') : fmt(v, K[k][2]) + ' ' + K[k][1]}</div></div>`).join('')).join('');
}

function airSpans(run) {
  const c = run.channels, out = []; let s = null;
  for (let i = 0; i < c.t.length; i++) {
    if (c.air[i] > 0.5 && s === null) s = c.t[i];
    if (c.air[i] < 0.5 && s !== null) { out.push({ t0: s, t1: c.t[i], color: '#e03131' }); s = null; }
  }
  return out;
}

// =================================================================== 6. stabilitate & SBC
function pageStability() {
  return `<section class="bpage" id="bp-stability">
  <div><h2>Stabilitate direcțională și Sensotronic Brake Control</h2></div>
  <div class="bgrid even">
    <div class="panel"><h3>Stabilitatea direcțională (fig. 2)</h3>
      <p>Comportamentul este satisfăcător dacă vehiculul urmează un traseu care reflectă exact unghiul de volan și rămâne stabil – fără să
      „împingă” (subvirare) și fără să scape. Răspunsul lateral este definit de mișcarea laterală (unghiul de derivă β) și de rotirea în jurul
      axei verticale (viteza de giratie).</p>
      <p>Cu volanul fix (platformă circulară), pe drum cu aderență mare vehiculul urmează exact cursul (curba 2). Pe drum alunecos, dacă se
      controlează doar viteza de giratie, vehiculul se rotește la fel de mult ca în cazul 2, dar unghiul de derivă devine excesiv (curba 3) –
      o sursă potențială de instabilitate. De aceea ESP controlează giratia <b>și</b> limitează unghiul de derivă (curba 4).</p>
      ${svgDirStab()}
      <button class="primary" data-scenario="directional-stability">▶ Compară în simulare (scenariul 11)</button>
    </div>
    <div class="panel"><h3>Sensotronic Brake Control (SBC)</h3>
      <p>SBC este un sistem de frânare electrohidraulic („brake-by-wire”) care combină funcțiile servofrânei și ale ABS, inclusiv ESP.
      Acționarea pedalei este măsurată redundant de unitatea de acționare și transmisă unității de control; aceasta calculează comenzile,
      transformate de modulator în presiuni. La defectarea electronicii, un sistem hidraulic de rezervă este disponibil automat.</p>
      <ul>
        <li>presiunea în etriere poate fi controlată independent de șofer → funcții dincolo de ABS/TCS/ESP (de ex. frânarea confortabilă pentru ACC);</li>
        <li>distribuția forței de frânare se face electronic, pe fiecare roată, în funcție de situație;</li>
        <li>nu mai este necesară sursa de vacuum pentru servofrână; autodiagnoza permite avertizarea timpurie a defectelor;</li>
        <li>folosește frâne de roată hidraulice standard și se integrează ușor cu sistemele de dinamică a vehiculului.</li>
      </ul>
      <p class="small">Componente (fig. 1 SBC): senzori activi de turație cu detecția sensului, ECU motor, ECU SBC, senzor de giratie și accelerație
      laterală, modulator hidraulic (SBC, ABS, TCS, ESP), unitate de acționare cu senzor de cursă a pedalei, senzor de unghi de volan.</p>
      <p class="small">Funcții de bază, ca orice sistem de frânare: reducerea vitezei, oprirea și menținerea vehiculului oprit; ca sistem activ:
      acționarea, amplificarea și modularea forței de frânare.</p>
    </div>
  </div></section>`;
}

function svgDirStab() {
  return `<svg viewBox="0 0 420 250" style="width:100%">
    <path d="M60,230 C60,120 140,40 260,40" fill="none" stroke="#2b8a3e" stroke-width="3"/>
    <path d="M60,230 C70,150 150,90 270,80" fill="none" stroke="#e8590c" stroke-width="3" stroke-dasharray="7 4"/>
    <path d="M60,230 C68,140 150,70 262,58" fill="none" stroke="#1c7ed6" stroke-width="3"/>
    <g transform="translate(250,40) rotate(-5)"><rect x="-14" y="-7" width="28" height="14" rx="3" fill="#2b8a3e"/></g>
    <g transform="translate(262,80) rotate(-60)"><rect x="-14" y="-7" width="28" height="14" rx="3" fill="#e8590c"/></g>
    <g transform="translate(255,58) rotate(-20)"><rect x="-14" y="-7" width="28" height="14" rx="3" fill="#1c7ed6"/></g>
    <text x="40" y="245" font-size="12" fill="var(--ink)">1 volan fix</text>
    <text x="290" y="40" font-size="12" fill="#2b8a3e">2 aderență mare</text>
    <text x="290" y="88" font-size="12" fill="#e8590c">3 doar giratie – β excesiv</text>
    <text x="290" y="62" font-size="12" fill="#1c7ed6">4 ESP: giratie + β</text>
  </svg>`;
}
