// Controlerul aplicației: încarcă scenariile, rulează simularea pe server (.NET), redă rezultatul.
import { LineChart, sample, sampleAuto, sampleStep, fmt } from './charts.js';
import { Scene } from './scene.js';
import { drawWheels, buildDiagram, updateDiagram } from './widgets.js';
import { renderTheory, renderModel, renderAbout } from './theory.js';
import { renderBrakes } from './brakes.js';
import { buildModulator, updateModulator, stateFromRun } from './hydraulics.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const WCOL = ['#e64980', '#7048e8', '#12b886', '#f59f00'];
const WNAME = ['FS', 'FD', 'SS', 'SD'];

const state = {
  scenarios: [], scenario: null, sim: null,
  t: 0, tEnd: 1, playing: false, rate: 1,
  focus: 1, show: 'both', evRun: 1,
  charts: [], selectedCharts: [],
  opt: { trail: true, forces: true, vel: true, ghost: false },
};

// ---------------------------------------------------------------- definițiile graficelor
const CHARTS = {
  sw: { title: 'Unghi de volan', unit: '°', build: (A, B) => both(A, B, 'sw') },
  r: {
    title: 'Viteza de giratie r', unit: '°/s', build: (A, B, F) => [
      ...both(A, B, 'r'),
      { run: B, key: 'rRef', label: 'r_ref (B)', color: css('--b'), dash: [6, 4], width: 1.3, alpha: .8 },
    ], symmetric: true,
  },
  beta: {
    title: 'Unghiul de derivă β', unit: '°', build: (A, B) => [
      ...both(A, B, 'beta'),
      { run: B, key: 'betaEst', label: 'β estimat (B)', color: css('--b'), dash: [2, 3], width: 1.3 },
    ], band: true, symmetric: true, clamp: 40,
  },
  ay: { title: 'Accelerația laterală a_y', unit: 'm/s²', build: (A, B) => both(A, B, 'ay'), symmetric: true },
  v: {
    title: 'Viteza vehiculului', unit: 'km/h', build: (A, B) => [
      ...both(A, B, 'v'),
      { run: B, key: 'vEst', label: 'v estimat (B)', color: css('--b'), dash: [5, 4], width: 1.2 },
    ],
  },
  p: {
    title: 'Presiuni de frânare (vehiculul selectat)', unit: 'bar', focus: true, build: (A, B, F) => [
      ...[0, 1, 2, 3].map(i => ({ run: F, key: 'p' + i, label: WNAME[i], color: WCOL[i] })),
      { run: F, key: 'pmc', label: 'cilindru principal', color: css('--ink'), dash: [5, 4], width: 1.2 },
    ],
  },
  slip: {
    title: 'Alunecarea roților la frânare λ (vehiculul selectat)', unit: '%', focus: true, build: (A, B, F) => [
      ...[0, 1, 2, 3].map(i => ({ run: F, key: 'slip' + i, label: WNAME[i], color: WCOL[i], width: 1.4 })),
      ...[0, 1, 2, 3].map(i => ({ run: F, key: 'slipTgt' + i, label: i === 0 ? 'țintă' : null, color: WCOL[i], dash: [3, 3], width: 1, noDot: true })),
    ], clampMin: -30, clampMax: 105,
  },
  wheels: {
    title: 'Vitezele roților (vehiculul selectat)', unit: 'km/h', focus: true, build: (A, B, F) => [
      ...[0, 1, 2, 3].map(i => ({ run: F, key: 'wv' + i, label: WNAME[i], color: WCOL[i], width: 1.4 })),
      { run: F, key: 'vEst', label: 'v referință', color: css('--ink'), dash: [5, 4], width: 1.3 },
    ],
  },
  torque: {
    title: 'Cuplul de antrenare la roți (vehiculul selectat)', unit: 'N·m', focus: true, build: (A, B, F) => [
      { run: F, key: 'tReq', label: 'cerut de șofer', color: css('--muted'), dash: [5, 4] },
      { run: F, key: 'tCmd', label: 'permis TCS/ESP', color: '#9c36b5', width: 1.3 },
      { run: F, key: 'tEng', label: 'efectiv', color: css('--ink'), width: 2 },
    ],
  },
  driveSlip: { title: 'Patinarea roților motoare', unit: '%', build: (A, B) => both(A, B, 'driveSlip'), clampMin: -40, clampMax: 100 },
  latErr: { title: 'Abaterea laterală față de traiectorie', unit: 'm', build: (A, B) => both(A, B, 'latErr'), symmetric: true, clamp: 15 },
  mz: {
    title: 'Momentul de giratie cerut de ESP (B)', unit: 'N·m', build: (A, B) => [
      { run: B, key: 'mz', label: 'M_z cerut', color: css('--b') },
    ], symmetric: true,
  },
  mu: {
    title: 'Coeficientul de aderență: real vs. estimat', unit: '–', focus: true, build: (A, B, F) => [
      { run: F, key: 'mu0', label: 'μ real FS', color: WCOL[0], width: 1.2 },
      { run: F, key: 'mu1', label: 'μ real FD', color: WCOL[1], width: 1.2, dash: [4, 3] },
      { run: F, key: 'muEst', label: 'μ estimat', color: css('--ink'), width: 2 },
    ], yMin: 0, yMax: 1.1,
  },
};
const both = (A, B, key) => [
  { run: A, key, label: A.label, color: A.color, width: 2 },
  { run: B, key, label: B.label, color: B.color, width: 2 },
];

// ---------------------------------------------------------------- inițializare
async function init() {
  setupTabs();
  setupControls();
  buildDiagram($('#diagram'));
  state.scene = new Scene($('#scene'));
  state.scene.redraw = () => drawFrame();
  state.scene.onFree = () => $$('#camSeg button').forEach(b => b.classList.remove('on'));

  const [sc, veh] = await Promise.all([fetch('api/scenarios').then(r => r.json()), fetch('api/vehicle').then(r => r.json())]);
  state.scenarios = sc;
  state.vehicle = veh;
  const tun = veh.tuning;
  $('#kp').value = tun.yawGainP; $('#kb').value = tun.betaGain; $('#db').value = tun.deadbandBase;
  updateOutputs();
  renderScenarioList();
  const last = localStorage.getItem('esp.scenario');
  selectScenario(sc.find(s => s.id === last) ?? sc[0]);
  run();
  requestAnimationFrame(loop);
}

function setupTabs() {
  let rendered = {};
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('active', x === b));
    $$('.tabpane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
    const t = b.dataset.tab;
    if (!rendered[t]) {
      if (t === 'theory') renderTheory($('#tab-theory'));
      if (t === 'model') renderModel($('#tab-model'), state.vehicle);
      if (t === 'about') renderAbout($('#tab-about'));
      if (t === 'brakes') renderBrakes($('#tab-brakes'), { openScenario });
      rendered[t] = true;
    }
    if (t === 'sim') setTimeout(() => { state.charts.forEach(c => c.render()); drawFrame(); }, 30);
  }));
  $('#themeBtn').addEventListener('click', () => {
    const d = document.documentElement;
    d.dataset.theme = d.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('esp.theme', d.dataset.theme);
    buildCharts(); drawFrame();
  });
  const th = localStorage.getItem('esp.theme'); if (th) document.documentElement.dataset.theme = th;
  $('#presentBtn').addEventListener('click', () => {
    document.body.classList.toggle('present');
    setTimeout(() => { state.charts.forEach(c => c.render()); drawFrame(); }, 50);
  });
}

function setupControls() {
  for (const id of ['speed', 'mu', 'steer', 'swd', 'kp', 'kb', 'db']) $('#' + id).addEventListener('input', updateOutputs);
  $$('.mu-presets button').forEach(b => b.addEventListener('click', () => { $('#mu').value = b.dataset.mu; updateOutputs(); }));
  $('#runBtn').addEventListener('click', run);
  $('#playBtn').addEventListener('click', togglePlay);
  $('#restartBtn').addEventListener('click', () => { seek(0); state.playing = true; updatePlayBtn(); });
  $('#stepBack').addEventListener('click', () => { state.playing = false; updatePlayBtn(); seek(state.t - 0.02); });
  $('#stepFwd').addEventListener('click', () => { state.playing = false; updatePlayBtn(); seek(state.t + 0.02); });
  $('#scrub').addEventListener('input', e => { seek(e.target.value / 1000 * state.tEnd); });
  $('#rate').addEventListener('change', e => state.rate = +e.target.value);
  seg('#camSeg', 'cam', v => { state.scene.setCamera(v); drawFrame(); });
  seg('#showSeg', 'show', v => { state.show = v; drawFrame(); });
  seg('#focusSeg', 'focus', v => { state.focus = v === 'A' ? 0 : 1; buildCharts(); drawFrame(); });
  seg('#evSeg', 'ev', v => { state.evRun = v === 'A' ? 0 : 1; renderEvents(); });
  seg('#viewSeg', 'view', v => {
    state.detailView = v;
    document.body.classList.toggle('modview', v === 'mod');
    setTimeout(() => { state.charts.forEach(c => c.render()); drawFrame(); }, 30);
    $('#wheelsView').style.display = v === 'wheels' ? '' : 'none';
    $('#modView').style.display = v === 'mod' ? '' : 'none';
    drawFrame();
  });
  buildModulator($('#modView'), { legend: true });
  for (const k of ['Trail', 'Forces', 'Vel', 'Ghost']) $('#opt' + k).addEventListener('change', e => { state.opt[k.toLowerCase()] = e.target.checked; drawFrame(); });
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowRight') { seek(state.t + 0.05); }
    if (e.code === 'ArrowLeft') { seek(state.t - 0.05); }
    if (e.code === 'Home') { seek(0); }
    if (e.code === 'Enter' && e.ctrlKey) run();
  });
}

function seg(sel, attr, cb) {
  $$(sel + ' button').forEach(b => b.addEventListener('click', () => {
    $$(sel + ' button').forEach(x => x.classList.toggle('on', x === b));
    cb(b.dataset[attr]);
  }));
}

function updateOutputs() {
  $('#speedOut').textContent = `${$('#speed').value} km/h`;
  $('#muOut').textContent = (+$('#mu').value).toLocaleString('ro-RO', { minimumFractionDigits: 2 });
  $('#steerOut').textContent = `${Math.round($('#steer').value * 100)}%`;
  $('#swdOut').textContent = (+$('#swd').value).toLocaleString('ro-RO');
  $('#kpOut').textContent = `${(+$('#kp').value / 1000).toFixed(0)}k N·m·s/rad`;
  $('#kbOut').textContent = `${(+$('#kb').value / 1000).toFixed(0)}k N·m/rad`;
  $('#dbOut').textContent = `${(+$('#db').value * 180 / Math.PI).toFixed(1)} °/s`;
}

function renderScenarioList() {
  $('#scenarioList').innerHTML = state.scenarios.map(s =>
    `<button class="sc-item" data-id="${s.id}"><b>${s.title}</b><span>${s.short}</span></button>`).join('');
  $$('.sc-item').forEach(b => b.addEventListener('click', () => {
    selectScenario(state.scenarios.find(s => s.id === b.dataset.id));
    run();
  }));
}

const SYS = [['ebd', 'EBD'], ['abs', 'ABS'], ['tcs', 'TCS'], ['edtc', 'EDTC'], ['esp', 'ESP'], ['gma', 'GMA'], ['betaControl', 'control β']];
function renderSystems(host, cfg, cls) {
  host.innerHTML = `<span class="veh-tag ${cls}">${cls.toUpperCase()}</span>` +
    SYS.map(([k, l]) => `<button class="chip-toggle ${cfg[k] ? 'on' : ''}" data-k="${k}">${l}</button>`).join('');
  host.querySelectorAll('.chip-toggle').forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));
}
const readSystems = host => Object.fromEntries(SYS.map(([k]) => [k, host.querySelector(`[data-k=${k}]`).classList.contains('on')]));

/** Apelat din pagina „Sisteme de frânare”: deschide simularea pe un scenariu și îl rulează. */
function openScenario(id) {
  const s = state.scenarios.find(x => x.id === id);
  if (!s) return;
  $$('.tab').find(b => b.dataset.tab === 'sim').click();
  selectScenario(s);
  run();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectScenario(s) {
  state.scenario = s;
  localStorage.setItem('esp.scenario', s.id);
  $$('.sc-item').forEach(b => b.classList.toggle('on', b.dataset.id === s.id));
  $('#speed').value = s.defaultSpeedKmh; $('#mu').value = s.defaultMu; $('#steer').value = 1; $('#swd').value = 6.5;
  $('#drivetrain').value = s.drivetrain; $('#mass').value = 0;
  $('#steerField').style.display = s.supportsSteeringScale ? '' : 'none';
  $('#swdField').style.display = s.isSineWithDwell ? '' : 'none';
  renderSystems($('#systemsA'), s.systemsA, 'a');
  renderSystems($('#systemsB'), s.systemsB, 'b');
  state.selectedCharts = [...s.defaultCharts];
  updateOutputs();
  $('#scTitle').textContent = s.title;
  $('#scRef').textContent = `Referință curs: ${s.bookReference}`;
  $('#scDesc').textContent = s.description;
  $('#observe').innerHTML = s.observe.map(o => `<li>${o}</li>`).join('');
}

// ---------------------------------------------------------------- rulare
async function run() {
  const s = state.scenario;
  const body = {
    scenarioId: s.id,
    speedKmh: +$('#speed').value,
    mu: +$('#mu').value,
    steeringScale: +$('#steer').value,
    swdMultiplier: +$('#swd').value,
    drivetrain: $('#drivetrain').value,
    extraMassKg: +$('#mass').value,
    systemsA: readSystems($('#systemsA')),
    systemsB: readSystems($('#systemsB')),
    sensorNoise: $('#noise').checked,
    idealMu: $('#idealMu').checked,
    tuning: {
      ...state.vehicle.tuning,
      yawGainP: +$('#kp').value, betaGain: +$('#kb').value, deadbandBase: +$('#db').value,
      engineIntervention: $('#engInt').checked,
    },
  };
  $('#runBtn').disabled = true; $('#runBtn').textContent = '… se calculează';
  const t0 = performance.now();
  try {
    const res = await fetch('api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    const sim = await res.json();
    prepare(sim);
    state.sim = sim;
    state.scene.setData(sim);
    state.tEnd = Math.max(...sim.runs.map(r => r.channels.t[r.channels.t.length - 1]));
    $('#runInfo').textContent = `Calcul pe server: ${sim.computeMs} ms (pas de integrare 0,5 ms, ciclu ECU 10 ms) · transfer + afișare: ${Math.round(performance.now() - t0)} ms`;
    $('#lblA').textContent = sim.runs[0].label; $('#sysA').textContent = '(' + sim.runs[0].systems + ')';
    $('#lblB').textContent = sim.runs[1].label; $('#sysB').textContent = '(' + sim.runs[1].systems + ')';
    renderChips(); buildCharts(); renderSummary(); renderEvents(); renderMarks();
    seek(0);
    state.playing = true; updatePlayBtn();
  } catch (e) {
    toast('Eroare la simulare: ' + e.message);
    console.error(e);
  } finally {
    $('#runBtn').disabled = false; $('#runBtn').textContent = '▶ Rulează simularea';
  }
}

/** Conversie a canalelor în Float32Array (valorile "NaN" vin ca text în JSON). */
function prepare(sim) {
  for (const r of sim.runs) {
    for (const k of Object.keys(r.channels)) {
      const a = r.channels[k];
      const f = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) f[i] = typeof a[i] === 'number' ? a[i] : NaN;
      r.channels[k] = f;
    }
  }
}

// ---------------------------------------------------------------- grafice
function renderChips() {
  $('#chartChips').innerHTML = Object.entries(CHARTS).map(([k, c]) =>
    `<button data-k="${k}" class="${state.selectedCharts.includes(k) ? 'on' : ''}">${c.title.replace(/ \(.*\)/, '')}</button>`).join('');
  $$('#chartChips button').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k;
    state.selectedCharts = state.selectedCharts.includes(k) ? state.selectedCharts.filter(x => x !== k) : [...state.selectedCharts, k];
    b.classList.toggle('on');
    buildCharts();
  }));
}

function buildCharts() {
  if (!state.sim) return;
  state.charts.forEach(c => c.destroy());
  state.charts = [];
  const host = $('#charts');
  host.innerHTML = '';
  const [A, B] = state.sim.runs;
  const F = state.sim.runs[state.focus];
  for (const k of state.selectedCharts) {
    const def = CHARTS[k];
    const series = def.build(A, B, F).filter(s => s.run.channels[s.key]).map(s => ({ ...s, t: s.run.channels.t, y: s.run.channels[s.key] }));
    if (!series.length) continue;
    const div = document.createElement('div');
    div.className = 'chart';
    const title = def.focus ? def.title.replace('vehiculul selectat', `vehiculul ${F.label}`) : def.title;
    div.innerHTML = `<div class="ct"><span>${title} [${def.unit}]</span><span class="cl">${series.filter(s => s.label)
      .map(s => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</span></div><canvas></canvas>`;
    host.appendChild(div);
    const cfg = { series };
    if (def.symmetric) cfg.symmetric = true;
    if (def.clamp) { cfg.clampMin = -def.clamp; cfg.clampMax = def.clamp; }
    if (def.clampMin !== undefined) { cfg.clampMin = def.clampMin; cfg.clampMax = def.clampMax; }
    if (def.yMin !== undefined) { cfg.yMin = def.yMin; cfg.yMax = def.yMax; }
    if (def.band) cfg.bands = [{ t: B.channels.t, lo: B.channels.betaLim.map(v => -v), hi: B.channels.betaLim, color: css('--b'), alpha: .1 }];
    cfg.spans = espSpans(F);
    cfg.xMax = state.tEnd;
    state.charts.push(new LineChart(div.querySelector('canvas'), cfg, t => { state.playing = false; updatePlayBtn(); seek(t); }));
  }
  state.charts.forEach(c => c.setCursor(state.t));
}

function espSpans(run) {
  const ch = run.channels, out = [];
  let start = null;
  for (let i = 0; i < ch.t.length; i++) {
    const on = ch.esp[i] > 0.5;
    if (on && start === null) start = ch.t[i];
    if (!on && start !== null) { out.push({ t0: start, t1: ch.t[i], color: css('--esp') }); start = null; }
  }
  if (start !== null) out.push({ t0: start, t1: ch.t[ch.t.length - 1], color: css('--esp') });
  return out;
}

// ---------------------------------------------------------------- rezultate
function renderSummary() {
  const [A, B] = state.sim.runs;
  const a = A.summary, b = B.summary;
  const row = (label, ka, kb, unit = '', d = 1, lowerBetter = true) => {
    const va = ka, vb = kb;
    const best = (va == null || vb == null) ? null : (lowerBetter ? (va < vb ? 'a' : vb < va ? 'b' : null) : (va > vb ? 'a' : vb > va ? 'b' : null));
    const cell = (v, k) => `<td class="${best === k ? 'good' : ''}">${v == null ? '–' : fmt(v, d) + unit}</td>`;
    return `<tr><td>${label}</td>${cell(va, 'a')}${cell(vb, 'b')}</tr>`;
  };
  const vcls = s => s.lostControl || s.verdict.includes('NEPROMOVAT') ? 'bad' : s.leftRoad || s.maxBetaDeg > 10 ? 'warn' : 'good';
  $('#summary').innerHTML = `
    <thead><tr><th></th><th style="color:${A.color}">${A.label}</th><th style="color:${B.color}">${B.label}</th></tr></thead>
    <tbody>
      <tr class="verdict"><td colspan="3"><span style="color:${A.color}">A:</span> <span class="${vcls(a)}">${a.verdict}</span><br>
        <span style="color:${B.color}">B:</span> <span class="${vcls(b)}">${b.verdict}</span></td></tr>
      ${row('β maxim', a.maxBetaDeg, b.maxBetaDeg, '°')}
      ${row('Giratie maximă', a.maxYawRateDeg, b.maxYawRateDeg, '°/s')}
      ${row('a<sub>y</sub> maximă', a.maxLateralAcc, b.maxLateralAcc, ' m/s²', 1, false)}
      ${row('Abatere laterală max.', a.maxPathDeviation, b.maxPathDeviation, ' m')}
      ${row('Viteză finală', a.finalSpeedKmh, b.finalSpeedKmh, ' km/h', 0, false)}
      ${a.stopDistance != null || b.stopDistance != null ? row('Distanță de oprire', a.stopDistance, b.stopDistance, ' m') : ''}
      ${row('Timp ESP activ', a.espActiveTime, b.espActiveTime, ' s', 2, false).replace(/class="good"/g, '')}
      ${row('Timp ABS activ', a.absActiveTime, b.absActiveTime, ' s', 2).replace(/class="good"/g, '')}
      ${row('Timp TCS activ', a.tcsActiveTime, b.tcsActiveTime, ' s', 2).replace(/class="good"/g, '')}
    </tbody>`;
  const info = state.sim.info;
  let extra = '';
  if (a.checks || b.checks) {
    extra += `<div class="ck"><b>Sine with Dwell</b> – A<sub>0,3g</sub> = ${fmt(info.A_0_3g_deg, 1)}°, amplitudine = ${fmt(info.swdAmplitudeDeg, 1)}° (${fmt(info.swdMultiplier, 1)}×)</div>`;
    for (const r of [A, B]) extra += `<div class="ck"><b style="color:${r.color}">${r.label}</b>${(r.summary.checks || []).map(c => `<div class="${c.startsWith('✔') ? 'good' : 'bad'}">${c}</div>`).join('')}</div>`;
  }
  if (info.steeringWheelDeg) extra += `<div class="muted small">Unghi de volan menținut: ${fmt(info.steeringWheelDeg, 1)}°</div>`;
  $('#checks').innerHTML = extra;
}

function renderEvents() {
  if (!state.sim) return;
  const run = state.sim.runs[state.evRun];
  $('#events').innerHTML = run.events.map((e, i) => `<li class="${e.kind}" data-t="${e.t}"><b>${fmt(e.t, 2)} s</b>${e.text}</li>`).join('')
    || '<li class="muted">Nicio intervenție a sistemelor electronice.</li>';
  $$('#events li[data-t]').forEach(li => li.addEventListener('click', () => { state.playing = false; updatePlayBtn(); seek(+li.dataset.t); }));
  highlightEvents();
}

function renderMarks() {
  const host = $('#marks');
  const colors = { esp: css('--esp'), abs: css('--abs'), tcs: css('--tcs'), edtc: css('--tcs'), loss: css('--bad'), road: css('--bad'), gma: css('--abs'), engine: css('--esp') };
  let html = '';
  state.sim.runs.forEach((r, k) => {
    for (const e of r.events) {
      if (!colors[e.kind]) continue;
      if (k === 0 && !['loss', 'road'].includes(e.kind)) continue;
      html += `<i style="left:${e.t / state.tEnd * 100}%;background:${colors[e.kind]}" title="${r.label}: ${e.text}"></i>`;
    }
  });
  host.innerHTML = html;
}

// ---------------------------------------------------------------- redare
function togglePlay() {
  if (!state.sim) return;
  if (!state.playing && state.t >= state.tEnd - 1e-3) seek(0);
  state.playing = !state.playing; updatePlayBtn();
}
function updatePlayBtn() { $('#playBtn').textContent = state.playing ? '❚❚' : '▶'; }

function seek(t) {
  state.t = Math.max(0, Math.min(state.tEnd, t));
  drawFrame();
}

let lastTs = null;
function loop(ts) {
  if (lastTs !== null && state.playing && state.sim) {
    const dt = Math.min(0.1, (ts - lastTs) / 1000);
    state.t += dt * state.rate;
    if (state.t >= state.tEnd) { state.t = state.tEnd; state.playing = false; updatePlayBtn(); }
    drawFrame();
  }
  lastTs = ts;
  requestAnimationFrame(loop);
}

function drawFrame() {
  if (!state.sim) return;
  const t = state.t;
  state.scene.render(t, { ...state.opt, show: state.show });
  $('#scrub').value = state.tEnd ? t / state.tEnd * 1000 : 0;
  $('#timeOut').textContent = `${fmt(t, 2)} s`;
  state.charts.forEach(c => c.setCursor(t));
  const F = state.sim.runs[state.focus];
  if (state.detailView === 'mod') updateModulator($('#modView'), stateFromRun(F, t, sample, sampleStep));
  else drawWheels($('#wheels'), F, t);
  updateDiagram($('#diagram'), F, t);
  renderHud(t);
  renderStatus(F, t);
  highlightEvents();
}

function statusOf(run, t) {
  const ch = run.channels, s = k => sampleAuto(ch, k, t);
  const tags = [];
  if (s('esp') > 0.5) tags.push([Math.round(s('mode')) === 1 ? 'ESP · supravirare' : 'ESP · subvirare', css('--esp')]);
  if ([0, 1, 2, 3].some(i => { const v = Math.round(s('st' + i)); return v === 2 || v === 3; })) tags.push(['ABS', css('--abs')]);
  if (s('tcs') > 0.5 || [0, 1, 2, 3].some(i => Math.round(s('st' + i)) === 4)) tags.push(['TCS', css('--tcs')]);
  if (s('edtc') > 0.5) tags.push(['EDTC', css('--tcs')]);
  if ((s('ebd') ?? 0) > 0.5) tags.push(['EBD', css('--ebd')]);
  const lost = run.events.find(e => e.kind === 'loss' && e.t <= t);
  if (lost) tags.push(['DERAPAJ', css('--bad')]);
  return tags;
}

function renderHud(t) {
  const runs = state.sim.runs.filter((r, i) => state.show === 'both' || state.show === (i ? 'B' : 'A'));
  $('#hud').innerHTML = runs.map(r => {
    const ch = r.channels, s = k => sampleAuto(ch, k, t);
    const tags = statusOf(r, t).map(([n, c]) => `<span class="tag" style="background:${c}">${n}</span>`).join(' ') || '<span class="muted">stabil</span>';
    return `<div class="hud-card" style="border-color:${r.color}">
      <div class="row"><b>${r.label}</b><span class="big">${fmt(s('v'), 0)} <small>km/h</small></span></div>
      <div class="row mono"><span>β ${fmt(s('beta'), 1)}°</span><span>r ${fmt(s('r'), 1)}°/s</span><span>a<sub>y</sub> ${fmt(s('ay'), 1)}</span></div>
      <div>${tags}</div></div>`;
  }).join('');
}

function renderStatus(run, t) {
  const ch = run.channels, s = k => sampleAuto(ch, k, t);
  const esp = s('esp') > 0.5, mode = Math.round(s('mode'));
  const pill = esp ? (mode === 1 ? '<span class="mode-pill mode-over">SUPRAVIRARE</span>' : '<span class="mode-pill mode-under">SUBVIRARE</span>')
    : '<span class="mode-pill mode-none">ESP inactiv</span>';
  const betaWarn = Math.abs(s('beta')) > s('betaLim') ? 'bad' : '';
  $('#statusBox').innerHTML = `
    <div class="stat wide"><div class="k">Stare regulator ESP – ${run.label} (${run.systems})</div><div class="v">${pill} <span class="mono">${esp ? 'M<sub>z</sub> = ' + fmt(s('mz'), 0) + ' N·m' : ''}</span></div></div>
    <div class="stat"><div class="k">Giratie r / r<sub>ref</sub></div><div class="v">${fmt(s('r'), 1)} / ${fmt(s('rRef'), 1)} °/s</div></div>
    <div class="stat"><div class="k">β real / estimat (lim. ±${fmt(s('betaLim'), 1)}°)</div><div class="v ${betaWarn}">${fmt(s('beta'), 1)} / ${fmt(s('betaEst'), 1)} °</div></div>
    <div class="stat"><div class="k">μ estimat · a<sub>y</sub></div><div class="v">${fmt(s('muEst'), 2)} · ${fmt(s('ay'), 1)} m/s²</div></div>
    <div class="stat"><div class="k">Cuplu cerut → efectiv</div><div class="v">${fmt(s('tReq'), 0)} → ${fmt(s('tEng'), 0)} N·m</div></div>
    <div class="stat"><div class="k">Volan · unghi roți</div><div class="v">${fmt(s('sw'), 0)}° · ${fmt(s('delta'), 1)}°</div></div>
    <div class="stat"><div class="k">v reală / estimată</div><div class="v">${fmt(s('v'), 0)} / ${fmt(s('vEst'), 0)} km/h</div></div>`;
}

function highlightEvents() {
  $$('#events li[data-t]').forEach(li => li.classList.toggle('past', +li.dataset.t > state.t));
}

function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

init().catch(e => { console.error(e); toast('Nu se poate contacta serverul: ' + e.message); });
