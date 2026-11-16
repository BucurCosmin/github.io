// Conținutul didactic: teoria ESP (după Bosch – Automotive Mechatronics, cap. ESP), modelul matematic,
// arhitectura aplicației. Include widget-uri interactive (curba μ–λ, cercul lui Kamm, modelul monocalea).
import { LineChart, fmt } from './charts.js';

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ================================================================= TEORIE
export function renderTheory(host) {
  host.innerHTML = `<article>
  <h1>Programul Electronic de Stabilitate (ESP)</h1>
  <p class="lead">ESP este un sistem cu buclă închisă care îmbunătățește comportamentul dinamic al vehiculului prin intervenții
  programate în sistemul de frânare și în grupul motopropulsor. El integrează funcțiile ABS (împiedicarea blocării roților la frânare)
  și TCS (împiedicarea patinării la accelerare) și, în plus, controlează tendința vehiculului de a nu urma comanda volanului
  (subvirare) sau de a se rota excesiv (supravirare) – în limitele impuse de legile fizicii.</p>

  <nav class="toc">
    <a href="#t1">1. De ce ESP</a><a href="#t2">2. Cerințe</a><a href="#t3">3. Principiul de funcționare</a>
    <a href="#t4">4. Supravirare / subvirare</a><a href="#t5">5. Aderența pneului</a><a href="#t6">6. Bucla de reglare</a>
    <a href="#t7">7. Ierarhia regulatoarelor</a><a href="#t8">8. Modelul monocalea</a><a href="#t9">9. ABS, TCS, EDTC</a>
    <a href="#t10">10. Manevrele de test</a><a href="#t11">11. Funcții de frânare automată</a>
  </nav>

  <h2 id="t1">1. De ce este necesar ESP</h2>
  <p>O parte importantă a accidentelor rutiere are drept cauză eroarea umană. Un obstacol apărut brusc sau o viteză neadaptată
  pot aduce vehiculul la limitele sale fizice, unde devine greu sau imposibil de controlat: forțele laterale depășesc capacitatea
  șoferului de a reacționa corect. Un șofer obișnuit nu știe că, la limita de aderență, comportamentul vehiculului devine
  puternic neliniar – iar reacția instinctivă (bracarea suplimentară, frânarea bruscă) poate agrava situația.</p>
  <figure>${svgSkid()}<figcaption>Fig. T1 – Vehicul fără ESP (după fig. 1 din curs): 1 – bracare, apar forțele laterale;
  2 – instabilitate incipientă (β prea mare); 3 – contrabracare, șoferul pierde controlul; 4 – vehicul necontrolabil.</figcaption></figure>
  <div class="note">În Uniunea Europeană ESC (Electronic Stability Control) a devenit obligatoriu pentru tipurile noi de autoturisme din
  noiembrie 2011 și pentru toate autoturismele noi înmatriculate din noiembrie 2014 (Regulamentul CE 661/2009, cu cerințele tehnice
  din Regulamentul ONU nr. 13-H / 140). Testul de omologare – „Sine with Dwell” – este disponibil în simulator (scenariul 9).</div>

  <h2 id="t2">2. Cerințe impuse sistemului</h2>
  <ul>
    <li><b>Stabilitate direcțională îmbunătățită</b> în toate regimurile: frânare de urgență, frânare normală, rulare liberă,
    accelerare, regim de frână de motor (overrun) și la schimbarea sarcinii.</li>
    <li><b>Stabilitate crescută la limita de aderență</b> – în manevre bruște de evitare („reacție de panică”) – pentru a reduce
    riscul de derapaj.</li>
    <li><b>Exploatarea mai bună a aderenței</b> când intervin ABS, TCS și EDTC (regulatorul cuplului de frână de motor, care crește
    automat turația motorului pentru a evita frânarea excesivă cu motorul): distanțe de frânare mai scurte, tracțiune mai bună,
    stabilitate și răspuns la volan superioare.</li>
  </ul>

  <h2 id="t3">3. Principiul de funcționare</h2>
  <p>ESP folosește <b>sistemul de frânare ca instrument de „virare”</b> a vehiculului. Când funcția de stabilitate intră în acțiune,
  prioritățile sistemului de frânare se schimbă: funcția de bază a frânelor (decelerarea) trece pe plan secundar, iar frânele sunt
  folosite pentru a menține vehiculul stabil și pe traiectorie.</p>
  <p>Frânarea unei singure roți produce o forță longitudinală care, având brațul egal cu jumătate din ecartament, generează un
  <b>moment de giratie</b> în jurul axei verticale a vehiculului:</p>
  <div class="eq">ΔM<sub>z</sub> ≈ ΔF<sub>x</sub> · s/2 &nbsp;&nbsp;(s – ecartamentul) <span class="lbl">(1)</span></div>
  <p>Pe lângă acest efect direct, frânarea modifică și <b>forța laterală</b> a roții respective (cercul lui Kamm, §5): o roată frânată
  poate transmite mai puțină forță laterală. ESP combină astfel două strategii de intervenție – <b>frânarea selectivă</b> a roților și
  <b>intervenția asupra motorului</b> (reducerea, respectiv creșterea cuplului de antrenare).</p>

  <h2 id="t4">4. Supravirare și subvirare – ce roată se frânează</h2>
  <figure>${svgOverUnder()}<figcaption>Fig. T2 – (a) Supravirare: puntea spate „scapă” → ESP frânează roata <b>față exterioară</b>;
  (b) Subvirare: puntea față „împinge” spre exterior → ESP frânează roata <b>spate interioară</b> (după fig. 5 din curs, aici pentru un viraj la dreapta).</figcaption></figure>
  <table>
    <tr><th>Situație</th><th>Diagnostic ESP</th><th>Moment necesar</th><th>Intervenție</th></tr>
    <tr><td>Viraj dreapta, supravirare</td><td>|r| &gt; |r<sub>ref</sub>| (se rotește prea repede)</td><td>sens trigonometric (spre stânga)</td><td>frânare roată față-stânga (exterioară)</td></tr>
    <tr><td>Viraj dreapta, subvirare</td><td>|r| &lt; |r<sub>ref</sub>| (se rotește prea încet)</td><td>sens orar (spre dreapta)</td><td>frânare roată spate-dreapta (interioară) + reducere cuplu motor</td></tr>
    <tr><td>Viraj stânga, supravirare</td><td>|r| &gt; |r<sub>ref</sub>|, β mare</td><td>sens orar</td><td>frânare roată față-dreapta (exterioară)</td></tr>
    <tr><td>Viraj stânga, subvirare</td><td>|r| &lt; |r<sub>ref</sub>|</td><td>sens trigonometric</td><td>frânare roată spate-stânga (interioară)</td></tr>
  </table>
  <p>De ce roata față la supravirare? Frânarea ei creează momentul corector <i>și</i> reduce forța laterală a punții față – ambele efecte
  reduc rotirea. La subvirare se frânează roata spate interioară: momentul corector „trage” vehiculul spre interior, iar forța
  laterală pierdută la spate nu este critică, deoarece puntea spate nu este cea saturată.</p>

  <h2 id="t5">5. Aderența pneului: curba μ–λ și cercul lui Kamm</h2>
  <p>Forța pe care o poate transmite un pneu este limitată de produsul μ·F<sub>z</sub>. Forța longitudinală depinde de alunecarea
  longitudinală λ, iar forța laterală de unghiul de derivă α. Când ambele sunt prezente, forța rezultantă rămâne în interiorul
  <b>cercului de aderență</b>: o roată frânată la limită (sau blocată) nu mai poate prelua forță laterală. ABS menține roțile în zona
  vârfului curbei μ–λ; ESP exploatează în mod deliberat acest compromis.</p>
  <div class="widget">
    <div class="grid2">
      <div>
        <div class="field"><label>Coeficient de aderență μ <output id="tw-mu-o"></output></label><input type="range" id="tw-mu" min="0.1" max="1.1" step="0.05" value="1"></div>
        <div class="field"><label>Unghi de derivă α <output id="tw-al-o"></output></label><input type="range" id="tw-al" min="0" max="12" step="0.5" value="3"></div>
        <div class="field"><label>Alunecare la frânare λ <output id="tw-la-o"></output></label><input type="range" id="tw-la" min="0" max="100" step="1" value="5"></div>
        <canvas id="tw-circle" style="height:260px"></canvas>
      </div>
      <div><canvas id="tw-curve" style="height:340px"></canvas>
        <div class="muted small"><span style="color:var(--accent)">━</span> F<sub>x</sub>/F<sub>z</sub> la unghiul α ales &nbsp; <span style="color:var(--muted)">┅</span> F<sub>x</sub>/F<sub>z</sub> la α = 0 &nbsp; <span style="color:var(--a)">┅</span> F<sub>y</sub>/F<sub>z</sub> rămasă — axa x: alunecarea λ [%]</div></div>
    </div>
  </div>

  <h2 id="t6">6. Bucla de reglare</h2>
  <figure>${svgLoop()}<figcaption>Fig. T3 – Schema bloc a ESP (după fig. 1 din cap. „Closed-loop control system”).</figcaption></figure>
  <p>Mai întâi se determină cum ar trebui să răspundă vehiculul la comanda șoferului (<b>comportamentul dorit</b>) și cum răspunde
  efectiv (<b>comportamentul real</b>). Actuatoarele acționează apoi pentru a minimiza diferența (abaterea de reglare), influențând
  indirect forțele din contactul pneu–drum. ESP controlează mărimile care descriu mișcarea plană: viteza longitudinală, viteza
  laterală și viteza de rotație în jurul axei verticale (<b>viteza de giratie r</b>).</p>
  <h4>Senzori și actuatoare (fig. 2 din curs)</h4>
  <table>
    <tr><th>Senzori</th><th>Unitatea de control</th><th>Actuatoare</th></tr>
    <tr><td>senzor de giratie cu accelerometru lateral; senzorul unghiului de volan; senzorul de presiune din cilindrul principal;
    4 senzori de turație a roților; (pe CAN) poziția pedalei de accelerație, cuplul motor</td>
    <td>regulator ESP (nivel superior) + regulatoarele de alunecare ABS/TCS și EDTC (nivel subordonat)</td>
    <td>modulatorul hidraulic (supape de admisie/evacuare, pompă de retur); managementul motorului – injecție, avans la aprindere,
    clapetă de accelerație electronică (ETC)</td></tr>
  </table>

  <h2 id="t7">7. Structura ierarhică a regulatoarelor</h2>
  <h4>Nivelul 1 – regulatorul ESP</h4>
  <p>Determină starea vehiculului pe baza vitezei de giratie (măsurată) și a unghiului de derivă β (estimat de „monitor”) și caută să
  apropie comportamentul la limită de cel din domeniul normal de funcționare. Comanda șoferului este citită din: pedala de
  accelerație (cuplul cerut), presiunea din cilindrul principal (frânarea) și unghiul volanului. Coeficientul de aderență și viteza
  vehiculului sunt estimate din turațiile roților, accelerația laterală, presiunile de frânare și viteza de giratie.</p>
  <p>Regulatorul guvernează două mărimi de stare – <b>viteza de giratie</b> și <b>unghiul de derivă</b> – și calculează momentul de
  giratie necesar. Cu cât β crește, cu atât importanța lui în legea de reglare este mai mare. Momentul este realizat <b>modificând
  alunecările-țintă</b> ale roților alese, transmise regulatoarelor ABS și TCS subordonate.</p>
  <h4>Nivelul 2 – regulatoarele de alunecare</h4>
  <ul>
    <li><b>ABS</b> – intră în funcțiune când alunecarea la frânare depășește valoarea admisă. Execută și frânarea activă ESP.
    Viteza vehiculului nu se măsoară direct: ea se derivă din turațiile roților. Prin „subfrânarea” periodică a unei roți (reducerea
    scurtă a presiunii) roata revine la rulare liberă și furnizează viteza reală a vehiculului.</li>
    <li><b>TCS</b> – limitează cuplul motor la cel transmisibil drumului; două mărimi reglate: viteza arborelui cardanic
    (constantă de timp mare, inerția întregii transmisii) → intervenție prin motor; diferența de viteză a roților motoare (constantă de
    timp mică) → frânare asimetrică.</li>
    <li><b>EDTC</b> – la ridicarea bruscă a piciorului de pe accelerație sau la retrogradare, frâna de motor poate bloca roțile motoare
    pe drum alunecos; EDTC accelerează „ușor” motorul.</li>
  </ul>
  <p>Intervenția la motor are două căi: <b>clapeta de accelerație</b> (lentă – întârziere de umplere a galeriei) și <b>avansul la
  aprindere / suprimarea injecției</b> (rapidă). La motoarele diesel cuplul se reduce prin cantitatea injectată (EDC).</p>

  <h2 id="t8">8. Modelul monocalea (single-track) – comportamentul de referință</h2>
  <figure>${svgBicycle()}<figcaption>Fig. T4 – Modelul monocalea: roțile fiecărei punți sunt înlocuite printr-o roată echivalentă;
  CG la nivelul drumului, singura rotație – giratia.</figcaption></figure>
  <p>Ipoteze: cinematica punților liniară; forța laterală a pneului liniară în α, momentul de autoaliniere neglijat; centrul de
  greutate la nivelul drumului (fără ruliu, tangaj, ridicare). Ecuațiile de mișcare (C<sub>f</sub>, C<sub>r</sub> – rigiditățile la derivă ale punților):</p>
  <div class="eq">m·v·(β̇ + r) = F<sub>yf</sub> + F<sub>yr</sub> <span class="lbl">(2)</span><br>
  I<sub>z</sub>·ṙ = a·F<sub>yf</sub> − b·F<sub>yr</sub> <span class="lbl">(3)</span><br>
  F<sub>yf</sub> = C<sub>f</sub>·(δ − β − a·r/v), &nbsp; F<sub>yr</sub> = C<sub>r</sub>·(−β + b·r/v) <span class="lbl">(4)</span></div>
  <p>În regim staționar rezultă giratia de referință și gradientul de subvirare EG:</p>
  <div class="eq">r<sub>ss</sub> = v·δ / (l + EG·v²), &nbsp;&nbsp; EG = (m/l)·(b/C<sub>f</sub> − a/C<sub>r</sub>) <span class="lbl">(5)</span><br>
  |r<sub>ref</sub>| ≤ μ·g / v &nbsp;&nbsp;(limitarea fizică – vehiculul trebuie să rămână pe o traiectorie realizabilă) <span class="lbl">(6)</span></div>
  <div class="widget">
    <div class="grid2">
      <div>
        <div class="field"><label>Unghi de volan <output id="tb-sw-o"></output></label><input type="range" id="tb-sw" min="5" max="180" step="5" value="45"></div>
        <div class="field"><label>μ <output id="tb-mu-o"></output></label><input type="range" id="tb-mu" min="0.1" max="1.1" step="0.05" value="1"></div>
        <p class="small muted">Giratia staționară cerută de șofer (modelul liniar) crește cu viteza până la viteza caracteristică,
        dar limita fizică μ·g/v scade cu viteza. Intersecția celor două curbe marchează viteza peste care
        ESP plafonează referința – vehiculul nu poate parcurge cercul cerut, indiferent de intervenție.</p>
      </div>
      <div><canvas id="tb-chart" style="height:280px"></canvas>
      <div class="small muted"><span style="color:var(--accent)">━</span> r cerut (model liniar) &nbsp; <span style="color:var(--bad)">┅</span> limita 0,95·μg/v &nbsp; <span style="color:var(--ok)">━</span> r<sub>ref</sub> folosit de ESP &nbsp; — axa x: viteza [km/h], axa y: giratia [°/s]</div></div>
    </div>
  </div>
  <h4>Domeniile accelerației laterale</h4>
  ${svgRanges()}
  <p>Domeniul mic-semnal (0…0,5 m/s²) – denivelări, vânt lateral; domeniul liniar (0,5…4 m/s²) – schimbări de bandă, descris corect
  de modelul monocalea liniar; domeniul de tranziție (4…6 m/s²) – unele vehicule încă liniare, altele nu; domeniul critic (&gt; 6 m/s²) –
  situații aproape de accident, răspuns puternic neliniar. Autoturismele ating până la ≈ 10 m/s².</p>

  <h2 id="t9">9. ESP în timpul funcționării ABS și TCS</h2>
  <p>În timpul ABS, regulatorul ESP transmite regulatorului ABS viteza laterală, viteza de giratie, unghiul de volan și vitezele roților,
  pentru stabilirea alunecării dorite. În timpul TCS, ESP transmite <i>offset-uri</i>: modificarea alunecării de tracțiune specificate,
  a toleranței de alunecare și a valorii care influențează reducerea cuplului. Astfel aderența disponibilă este exploatată maxim
  în toate condițiile.</p>
  <div class="note">În simulator, la frânarea pe μ-split, ESP atenuează giratia de referință (contrabracarea șoferului compensează
  momentul perturbator și nu reprezintă o cerere de viraj) și folosește <b>GMA</b> – creșterea întârziată a presiunii pe roata față cu
  aderență mare – pentru ca șoferul să aibă timp să corecteze.</div>

  <h2 id="t10">10. Manevrele de test din curs (reproduse în simulator)</h2>
  <table>
    <tr><th>Manevră</th><th>Condiții</th><th>Fără ESP</th><th>Cu ESP</th></tr>
    <tr><td>Bracare/contrabracare rapidă</td><td>144 km/h, μ = 1, fără frânare</td><td>după contrabracare r și β cresc radical, derapaj</td><td>frânare față-stânga, apoi față-dreapta – urmează cursul</td></tr>
    <tr><td>Schimbare de bandă + frânare</td><td>50 km/h, μ = 0,15, cu ABS</td><td>două contrabracări, stabilizare la limită</td><td>stabil, distanță de oprire mai mică</td></tr>
    <tr><td>Bracări succesive cu unghi crescător</td><td>72 km/h constant, zăpadă μ = 0,45</td><td>patinarea roților motoare → instabilitate bruscă</td><td>intervenție timpurie: motor + frânare individuală</td></tr>
    <tr><td>Accelerare pe platforma circulară</td><td>R = 100 m, μ = 1</td><td>subvirare, apoi spatele scapă</td><td>refuză accelerarea peste limita de stabilitate</td></tr>
    <tr><td>Frânare / accelerare în viraj</td><td>volan fix</td><td>vehiculul „intră” în curbă (supravirare)</td><td>modulare individuală a presiunii</td></tr>
  </table>
  <div class="note warn">Valorile numerice obținute în simulator (de ex. viteza limită pe platforma circulară) depind de parametrii
  vehiculului și ai pneurilor din model și nu coincid exact cu cele din curs – <i>tendințele</i> și mecanismele sunt însă aceleași.</div>

  <h2 id="t11">11. Funcții de frânare automată construite pe ESP</h2>
  <p>Capacitatea ESP de a genera presiune independent de pedală permite o serie de funcții suplimentare (cap. „Automatic brake functions”):</p>
  <table>
    <tr><th>Funcție</th><th>Descriere</th></tr>
    <tr><td>EBD</td><td>distribuția electronică a forței de frânare între punți (înlocuiește limitatorul mecanic)</td></tr>
    <tr><td>HBA</td><td>asistența la frânarea de urgență – detectează frânarea de panică și crește presiunea până la limita de blocare</td></tr>
    <tr><td>CDP</td><td>decelerarea controlată pentru frâna de parcare – oprirea vehiculului la cererea șoferului</td></tr>
    <tr><td>HHC</td><td>asistența la pornirea în rampă</td></tr>
    <tr><td>HDC</td><td>controlul vitezei la coborârea pantelor</td></tr>
    <tr><td>CDD, ACC</td><td>decelerare controlată pentru sisteme de asistență (ex. pilot automat adaptiv)</td></tr>
    <tr><td>BDW</td><td>ștergerea discurilor de frână pe ploaie</td></tr>
  </table>
  </article>`;

  initTireWidget();
  initBicycleWidget();
}

// ------------------------------------------------- widget: pneu
function mf(s, c = 1.4, e = -0.5) {
  const b = 1 / c, bs = b * s;
  return Math.sin(c * Math.atan(bs - e * (bs - Math.atan(bs))));
}
/** Același model ca în C# (TireModel.Compute) – roată față, Fz = 4000 N. */
function tire(mu, kappa, tanA) {
  const fz = 4000, cy = 17 * fz, cx = 14 * fz, fmax = mu * fz;
  const sx = cx * kappa, sy = cy * tanA, s = Math.hypot(sx, sy);
  if (s < 1e-6) return { fx: sx, fy: -sy };
  const f = fmax * mf(s / fmax);
  return { fx: f * sx / s, fy: -f * sy / s };
}

function initTireWidget() {
  const curve = new LineChart(document.getElementById('tw-curve'), { series: [] });
  const circ = document.getElementById('tw-circle');
  const upd = () => {
    const mu = +tw('mu').value, al = +tw('al').value, la = +tw('la').value / 100;
    tw('mu-o').textContent = fmt(mu, 2); tw('al-o').textContent = fmt(al, 1) + '°'; tw('la-o').textContent = fmt(la * 100, 0) + '%';
    const t = [], fx = [], fy = [], fx0 = [];
    for (let l = 0; l <= 1.0001; l += 0.005) {
      t.push(l * 100);
      const r = tire(mu, -l, Math.tan(al * Math.PI / 180));
      fx.push(-r.fx / 4000); fy.push(Math.abs(r.fy) / 4000);
      fx0.push(-tire(mu, -l, 0).fx / 4000);
    }
    curve.setData({
      series: [
        { t, y: fx0, color: css('--muted'), width: 1.5, dash: [5, 4], label: 'α = 0' },
        { t, y: fx, color: css('--accent'), width: 2.4, label: 'F_x / F_z' },
        { t, y: fy, color: css('--a'), width: 2, dash: [2, 3], label: 'F_y / F_z' },
      ], yMin: 0, yMax: 1.1,
    });
    curve.setCursor(la * 100);
    // cercul lui Kamm
    const dpr = devicePixelRatio || 1, w = circ.clientWidth, h = circ.clientHeight;
    circ.width = w * dpr; circ.height = h * dpr;
    const g = circ.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = Math.min(w, h) * 0.38, cx = w / 2, cy = h / 2 + 6;
    const r = tire(mu, -la, Math.tan(al * Math.PI / 180));
    const k = R / 4000 / 1.1;
    g.strokeStyle = css('--line'); g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx - R * 1.15, cy); g.lineTo(cx + R * 1.15, cy); g.moveTo(cx, cy - R * 1.15); g.lineTo(cx, cy + R * 1.15); g.stroke();
    g.strokeStyle = css('--accent'); g.lineWidth = 2; g.fillStyle = 'rgba(28,126,214,.08)';
    g.beginPath(); g.arc(cx, cy, mu * 4000 * k, 0, Math.PI * 2); g.fill(); g.stroke();
    const ex = cx - r.fy * k * -1, ey = cy + (-r.fx) * k; // laterala spre dreapta, frânarea în jos
    g.strokeStyle = css('--a'); g.fillStyle = css('--a'); g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.abs(r.fy) * k, cy + (-r.fx) * k); g.stroke();
    g.beginPath(); g.arc(cx + Math.abs(r.fy) * k, cy + (-r.fx) * k, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = css('--ink-2'); g.font = '12px ' + css('--sans');
    g.fillText('forță laterală →', cx + 8, cy - 6);
    g.fillText('↓ forță de frânare', cx + 4, cy + R * 1.1);
    g.fillText(`F_x = ${fmt(-r.fx, 0)} N   F_y = ${fmt(Math.abs(r.fy), 0)} N   (μF_z = ${fmt(mu * 4000, 0)} N)`, 8, 14);
    void ex; void ey;
  };
  const tw = k => document.getElementById('tw-' + k);
  for (const k of ['mu', 'al', 'la']) tw(k).addEventListener('input', upd);
  setTimeout(upd, 30);
}

function initBicycleWidget() {
  const ch = new LineChart(document.getElementById('tb-chart'), { series: [] });
  const P = { m: 1550, a: 1.15, b: 1.55, l: 2.7, cf: 2 * 17 * 1550 * 9.81 * 1.55 / 5.4, cr: 2 * 21 * 1550 * 9.81 * 1.15 / 5.4 };
  const EG = P.m / P.l * (P.b / P.cf - P.a / P.cr);
  const upd = () => {
    const sw = +document.getElementById('tb-sw').value, mu = +document.getElementById('tb-mu').value;
    document.getElementById('tb-sw-o').textContent = sw + '°';
    document.getElementById('tb-mu-o').textContent = fmt(mu, 2);
    const d = sw / 16 * Math.PI / 180;
    const t = [], rl = [], lim = [];
    for (let v = 5; v <= 200; v += 1) {
      const ms = v / 3.6;
      t.push(v);
      rl.push(ms * d / (P.l + EG * ms * ms) * 180 / Math.PI);
      lim.push(Math.min(80, 0.95 * mu * 9.81 / ms * 180 / Math.PI));
    }
    ch.setData({
      series: [
        { t, y: rl, color: css('--accent'), width: 2.4, label: 'r cerut (liniar)' },
        { t, y: lim, color: css('--bad'), width: 2, dash: [6, 4], label: 'limita μg/v' },
        { t, y: rl.map((v, i) => Math.min(v, lim[i])), color: css('--ok'), width: 3.5, alpha: .45, label: 'r_ref' },
      ], yMin: 0,
    });
  };
  for (const id of ['tb-sw', 'tb-mu']) document.getElementById(id).addEventListener('input', upd);
  setTimeout(upd, 30);
}

// ------------------------------------------------- SVG-uri
function car(x, y, ang, color, braked = -1, scale = 1) {
  const wheels = [[-14, -9], [14, -9], [-14, 9], [14, 9]]; // FL, FR, RL, RR (față = sus)
  return `<g transform="translate(${x},${y}) rotate(${ang}) scale(${scale})">
    <rect x="-11" y="-22" width="22" height="44" rx="6" fill="${color}" stroke="rgba(0,0,0,.4)"/>
    <rect x="-8" y="-14" width="16" height="7" rx="2" fill="rgba(255,255,255,.6)"/>
    ${wheels.map(([wx, wy], i) => `<rect x="${(wx < 0 ? -14 : 11)}" y="${wy < 0 ? -19 : 9}" width="4" height="10" rx="1" fill="${i === braked ? '#e03131' : '#222'}"/>`).join('')}
    ${braked >= 0 ? `<circle cx="${braked % 2 === 0 ? -12 : 12}" cy="${braked < 2 ? -14 : 14}" r="8" fill="none" stroke="#e03131" stroke-width="2"/>` : ''}
  </g>`;
}

function svgSkid() {
  const road = `<path d="M40,260 C120,250 160,120 260,90 S420,40 560,60" stroke="#868e96" stroke-width="64" fill="none" opacity=".35"/>`;
  return `<svg viewBox="0 0 600 280" xmlns="http://www.w3.org/2000/svg">${road}
    <path d="M60,250 C130,240 170,130 250,100" stroke="#d9480f" stroke-width="2" stroke-dasharray="6 4" fill="none"/>
    ${car(70, 245, 80, '#d9480f')}<text x="70" y="215" text-anchor="middle" font-size="14" font-weight="700">1</text>
    ${car(170, 170, 40, '#d9480f')}<text x="200" y="160" font-size="14" font-weight="700">2</text>
    ${car(270, 100, 140, '#d9480f')}<text x="300" y="98" font-size="14" font-weight="700">3</text>
    ${car(370, 120, 220, '#d9480f')}<text x="400" y="128" font-size="14" font-weight="700">4</text>
    <text x="300" y="268" font-size="12" text-anchor="middle" fill="#7a8699">β crește → vehiculul nu mai răspunde la volan</text></svg>`;
}

function svgOverUnder() {
  const arc = (cx) => `<path d="M${cx - 120},260 A220,220 0 0 1 ${cx + 110},40" stroke="#868e96" stroke-width="58" fill="none" opacity=".3"/>`;
  return `<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg">
    <text x="150" y="20" text-anchor="middle" font-weight="700">(a) Supravirare – viraj dreapta</text>
    ${arc(170)}
    ${car(130, 160, 20, '#1c7ed6', 0, 1.6)}
    <path d="M150,115 A55,55 0 0 1 95,120" stroke="#e03131" stroke-width="2.5" fill="none" marker-end="url(#ah)"/>
    <text x="40" y="250" font-size="12">spatele derapează spre exterior;</text>
    <text x="40" y="266" font-size="12">frânare <tspan fill="#e03131" font-weight="700">față-stânga</tspan> → moment trigonometric</text>
    <text x="470" y="20" text-anchor="middle" font-weight="700">(b) Subvirare – viraj dreapta</text>
    ${arc(490)}
    ${car(450, 160, 20, '#1c7ed6', 3, 1.6)}
    <path d="M488,220 A55,55 0 0 0 430,210" stroke="#e03131" stroke-width="2.5" fill="none" marker-end="url(#ah)"/>
    <text x="360" y="250" font-size="12">fața „împinge” spre exterior;</text>
    <text x="360" y="266" font-size="12">frânare <tspan fill="#e03131" font-weight="700">spate-dreapta</tspan> → moment orar</text>
    <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="#e03131"/></marker></defs>
  </svg>`;
}

function svgLoop() {
  const b = (x, y, w, t, sub = '') => `<g><rect x="${x}" y="${y}" width="${w}" height="46" rx="8" fill="var(--panel-2)" stroke="var(--line)"/>
    <text x="${x + w / 2}" y="${y + (sub ? 20 : 28)}" text-anchor="middle" font-size="13" fill="var(--ink)">${t}</text>
    ${sub ? `<text x="${x + w / 2}" y="${y + 36}" text-anchor="middle" font-size="11" fill="var(--muted)">${sub}</text>` : ''}</g>`;
  return `<svg viewBox="0 0 760 230" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="la" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="#7a8699"/></marker></defs>
    ${b(10, 20, 130, 'Comanda șoferului', 'volan, pedale')}
    ${b(180, 20, 150, 'Comportament dorit', 'model de referință')}
    ${b(380, 20, 160, 'Regulator', 'calculul corecției')}
    ${b(590, 20, 160, 'Actuatoare', 'frâne, motor')}
    ${b(590, 140, 160, 'Vehicul', 'bucla de reglare')}
    ${b(380, 140, 160, 'Mărimi măsurate', 'și estimate (monitor)')}
    <circle cx="355" cy="43" r="12" fill="var(--panel)" stroke="var(--ink-2)"/><text x="355" y="48" text-anchor="middle" font-size="14">−</text>
    <g stroke="#7a8699" stroke-width="1.6" fill="none">
      <path d="M140,43 L180,43" marker-end="url(#la)"/><path d="M330,43 L343,43" marker-end="url(#la)"/>
      <path d="M367,43 L380,43" marker-end="url(#la)"/><path d="M540,43 L590,43" marker-end="url(#la)"/>
      <path d="M670,66 L670,140" marker-end="url(#la)"/><path d="M590,163 L540,163" marker-end="url(#la)"/>
      <path d="M380,163 L355,163 L355,55" marker-end="url(#la)"/>
    </g>
    <text x="362" y="120" font-size="11" fill="var(--muted)">comportament real</text>
    <text x="400" y="85" font-size="11" fill="var(--muted)">abaterea de reglare (r_ref − r, β)</text>
  </svg>`;
}

function svgBicycle() {
  return `<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg">
    <defs>${[['bg', '#2f9e44'], ['bo', '#e8590c'], ['bk', '#7a8699']].map(([id, c]) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="${c}"/></marker>`).join('')}</defs>
    <g transform="translate(320,140) rotate(-12)">
      <line x1="-200" y1="0" x2="200" y2="0" stroke="var(--line)" stroke-dasharray="4 4"/>
      <line x1="-130" y1="0" x2="150" y2="0" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/>
      <rect x="-150" y="-9" width="40" height="18" rx="4" fill="#343a40"/>
      <g transform="translate(130,0) rotate(-14)"><rect x="-20" y="-9" width="40" height="18" rx="4" fill="#343a40"/>
        <line x1="-60" y1="0" x2="80" y2="0" stroke="var(--accent)" stroke-dasharray="3 3"/></g>
      <circle cx="0" cy="0" r="9" fill="var(--panel)" stroke="var(--ink)" stroke-width="2"/><circle cx="0" cy="0" r="3" fill="var(--ink)"/>
      <path d="M0,0 L170,-30" stroke="#2f9e44" stroke-width="2.5" marker-end="url(#bg)"/>
      <path d="M130,0 L120,-70" stroke="#e8590c" stroke-width="2.5" marker-end="url(#bo)"/>
      <path d="M-130,0 L-130,-60" stroke="#e8590c" stroke-width="2.5" marker-end="url(#bo)"/>
      <path d="M60,0 A60,60 0 0 0 59,-10" stroke="#2f9e44" fill="none"/>
      <text x="66" y="-6" font-size="13" fill="#2f9e44">β</text>
      <text x="176" y="-30" font-size="13" fill="#2f9e44">v</text>
      <text x="98" y="-74" font-size="13" fill="#e8590c">F<tspan baseline-shift="sub" font-size="9">yf</tspan></text>
      <text x="-122" y="-50" font-size="13" fill="#e8590c">F<tspan baseline-shift="sub" font-size="9">yr</tspan></text>
      <text x="152" y="26" font-size="13" fill="var(--accent)">δ</text>
      <text x="60" y="20" font-size="12" fill="var(--ink-2)">a</text><text x="-70" y="20" font-size="12" fill="var(--ink-2)">b</text>
      <text x="-12" y="26" font-size="12" fill="var(--ink-2)">CG</text>
      <path d="M-26,-30 A40,40 0 1 1 26,-30" stroke="#7a8699" fill="none" marker-end="url(#bk)"/>
      <text x="-6" y="-46" font-size="13" fill="var(--ink-2)">r</text>
    </g></svg>`;
}

function svgRanges() {
  const seg = [[0, 0.5, '#b2f2bb', 'mic'], [0.5, 4, '#74c0fc', 'liniar'], [4, 6, '#ffd43b', 'tranziție'], [6, 10, '#ff8787', 'critic']];
  const X = v => 30 + v / 10 * 580;
  return `<svg viewBox="0 0 640 70" xmlns="http://www.w3.org/2000/svg">
    ${seg.map(([a, b, c, t]) => `<rect x="${X(a)}" y="10" width="${X(b) - X(a)}" height="24" fill="${c}"/><text x="${(X(a) + X(b)) / 2}" y="27" text-anchor="middle" font-size="12">${t}</text>`).join('')}
    ${[0, 0.5, 4, 6, 10].map(v => `<text x="${X(v)}" y="52" text-anchor="middle" font-size="11" fill="var(--muted)">${v.toLocaleString('ro-RO')}</text>`).join('')}
    <text x="620" y="66" text-anchor="end" font-size="11" fill="var(--muted)">a_y [m/s²]</text></svg>`;
}

// ================================================================= MODEL MATEMATIC
export function renderModel(host, veh) {
  const p = veh.parameters, d = veh.derived, t = veh.tuning;
  const row = (n, s, v, u) => `<tr><td>${n}</td><td>${s}</td><td class="mono">${v}</td><td>${u}</td></tr>`;
  host.innerHTML = `<article>
  <h1>Modelul matematic al simulatorului</h1>
  <p class="lead">Simulatorul integrează un model de vehicul cu 7 grade de libertate și o unitate de control ESP cu structura ierarhică
  din curs. Calculul se face pe server (C#, .NET 10), cu pas fix de 0,5 ms; unitatea de control rulează cu ciclul de 10 ms al
  unui calculator de bord; rezultatele sunt înregistrate la 50 Hz.</p>
  <nav class="toc"><a href="#m1">1. Vehiculul</a><a href="#m2">2. Pneul</a><a href="#m3">3. Roțile și frânele</a><a href="#m4">4. Motorul</a>
  <a href="#m5">5. Monitorul</a><a href="#m6">6. Regulatorul ESP</a><a href="#m7">7. Regulatoarele de alunecare</a><a href="#m8">8. Șoferul</a><a href="#m9">9. Parametri</a></nav>

  <h2 id="m1">1. Modelul plan al vehiculului (7 GL)</h2>
  <p>Stări: v<sub>x</sub>, v<sub>y</sub>, r (corp) și ω<sub>1…4</sub> (roți), plus poziția X, Y, ψ. Sistemul de axe ISO 8855 (x înainte,
  y stânga, z în sus). Forțele roților față se rotesc cu unghiul de bracare δ = δ<sub>V</sub>/i<sub>s</sub>.</p>
  <div class="eq">m(v̇<sub>x</sub> − r·v<sub>y</sub>) = Σ F<sub>x,i</sub> − ½ρc<sub>x</sub>A·v<sub>x</sub>² − f<sub>r</sub>·m·g<br>
  m(v̇<sub>y</sub> + r·v<sub>x</sub>) = Σ F<sub>y,i</sub><br>
  I<sub>z</sub>·ṙ = Σ ( x<sub>i</sub>·F<sub>y,i</sub> − y<sub>i</sub>·F<sub>x,i</sub> ) <span class="lbl">(M1)</span></div>
  <p>Viteza centrului roții i: v<sub>x,i</sub> = v<sub>x</sub> − r·y<sub>i</sub>, &nbsp; v<sub>y,i</sub> = v<sub>y</sub> + r·x<sub>i</sub> (rotite cu δ la puntea față).</p>
  <h4>Transferul de sarcină (cvasi-static, filtrat cu τ = 60 ms)</h4>
  <div class="eq">ΔF<sub>z,long</sub> = m·a<sub>x</sub>·h / (2l) &nbsp;&nbsp;&nbsp;
  ΔF<sub>z,lat,f</sub> = φ<sub>f</sub>·m·a<sub>y</sub>·h / s<sub>f</sub>, &nbsp; ΔF<sub>z,lat,r</sub> = (1−φ<sub>f</sub>)·m·a<sub>y</sub>·h / s<sub>r</sub> <span class="lbl">(M2)</span></div>
  <p>φ<sub>f</sub> – fracțiunea din rigiditatea la ruliu preluată de puntea față; o valoare mare face vehiculul mai subvirator la limită.</p>

  <h2 id="m2">2. Modelul pneului – alunecare combinată</h2>
  <p>Alunecarea longitudinală κ = (ω·R − v<sub>x,w</sub>)/|v<sub>x,w</sub>| și tan α = v<sub>y,w</sub>/|v<sub>x,w</sub>|. Forțele „liniare”
  și alunecarea normalizată:</p>
  <div class="eq">s<sub>x</sub> = C<sub>x</sub>·κ, &nbsp; s<sub>y</sub> = C<sub>α</sub>·tan α, &nbsp; S = √(s<sub>x</sub>² + s<sub>y</sub>²), &nbsp; F<sub>max</sub> = μ<sub>ef</sub>·F<sub>z</sub><br>
  F = F<sub>max</sub> · sin( C·arctan( B·σ − E·(B·σ − arctan(B·σ)) ) ), &nbsp; σ = S/F<sub>max</sub>, &nbsp; B = 1/C<br>
  F<sub>x</sub> = F·s<sub>x</sub>/S, &nbsp;&nbsp; F<sub>y</sub> = −F·s<sub>y</sub>/S <span class="lbl">(M3)</span></div>
  <p>Este o formă normalizată a „Magic Formula” Pacejka (panta 1 în origine, maxim F<sub>max</sub>, valoare la alunecare totală
  sin(Cπ/2) ≈ 0,81·F<sub>max</sub> pentru C = 1,4), aplicată vectorului de alunecare – rezultă automat cercul lui Kamm.
  Sensibilitatea la sarcină: C<sub>α</sub>, C<sub>x</sub> ∝ F<sub>z</sub>(1 − 0,12(F<sub>z</sub>/F<sub>z0</sub> − 1)), μ<sub>ef</sub> = μ(1 − k<sub>μ</sub>(F<sub>z</sub>/F<sub>z0</sub> − 1)).</p>

  <h2 id="m3">3. Dinamica roților și modulatorul hidraulic</h2>
  <div class="eq">I<sub>w</sub>·ω̇ = T<sub>antr</sub> − F<sub>x</sub>·R − T<sub>fr</sub>·sgn ω, &nbsp;&nbsp; T<sub>fr</sub> = k<sub>fr</sub>·p <span class="lbl">(M4)</span></div>
  <p>Ecuația este integrată semi-implicit (panta locală ∂F<sub>x</sub>/∂ω inclusă în inerția efectivă), ceea ce o face stabilă și la
  viteze mici; frânarea nu poate inversa sensul de rotație (roata se blochează). Presiunea din fiecare etrier urmărește ținta cu
  constanta de timp a supapelor (20 ms) și limitări de gradient: creștere 1800 bar/s prin cilindrul principal, 350 bar/s când
  presiunea e generată activ de pompă (ESP/TCS), scădere 2500 bar/s.</p>

  <h2 id="m4">4. Grupul motopropulsor</h2>
  <div class="eq">T<sub>cerut</sub> = θ·min(T<sub>max</sub>, P·R/v) + (1 − θ)·T<sub>frână motor</sub>(v) <br>
  T<sub>cmd</sub> = max( T<sub>EDTC</sub>, min(T<sub>cerut</sub>, T<sub>TCS</sub>, T<sub>ESP</sub>) ) <br>
  Ṫ = (T<sub>cmd</sub> − T)/τ, &nbsp; τ = 40 ms la reducere (aprindere/injecție), 250 ms la creștere (clapetă) <span class="lbl">(M5)</span></div>
  <p>Diferențial deschis – cuplul se împarte egal la roțile motoare (FWD/RWD) sau 40/60 (AWD). La frânare puternică șoferul decuplează (fără frână de motor).</p>

  <h2 id="m5">5. Monitorul (estimatorul de stare)</h2>
  <ul>
    <li><b>Viteza vehiculului</b>: vitezele roților raportate la CG (corecție r·y<sub>i</sub> și cos δ); la frânare – roata cea mai rapidă,
    la tracțiune – roțile nemotoare; gradient limitat de aderența estimată. În ABS, o roată spate este „subfrânată” periodic (90 ms la 0,6 s).</li>
    <li><b>μ</b>: din utilizarea aderenței √(a<sub>x</sub>² + a<sub>y</sub>²)/g când se detectează saturația (ABS/TCS activ, subvirare, β mare);
    în ABS – din cuplul de frânare (presiunea din modelul hidraulic): μ ≈ (T<sub>fr</sub> + I<sub>w</sub>·ω̇)/(R·F<sub>z</sub>).</li>
    <li><b>β</b>: observator cinematic cu corecție spre modelul liniar, ponderată după domeniul accelerației laterale:</li>
  </ul>
  <div class="eq">β̂̇ = a<sub>y</sub>/v − r − (β̂ − β<sub>lin</sub>)/τ, &nbsp; τ = 0,25 s (|a<sub>y</sub>| &lt; 2) · 0,8 s (liniar) · 6 s (neliniar) <span class="lbl">(M6)</span></div>

  <h2 id="m6">6. Regulatorul ESP (nivel 1)</h2>
  <div class="eq">e = r<sub>ref</sub> − r, &nbsp; banda moartă e<sub>0</sub> = ${fmt(t.deadbandBase * 180 / Math.PI, 1)} °/s + ${fmt(t.deadbandRel * 100, 0)}%·|r<sub>ref</sub>|<br>
  M<sub>z,r</sub> = K<sub>p</sub>·e<sub>db</sub> + K<sub>d</sub>·ė &nbsp;&nbsp; (K<sub>p</sub> = ${t.yawGainP}, K<sub>d</sub> = ${t.yawGainD})<br>
  M<sub>z,β</sub> = sgn β · [ K<sub>β</sub>·(|β̂| − β<sub>lim</sub>/2) + K<sub>β̇</sub>·max(0, sgn β·β̂̇) ] &nbsp; (K<sub>β</sub> = ${t.betaGain}, K<sub>β̇</sub> = ${t.betaRateGain})<br>
  M<sub>z</sub> = (1 − w/2)·M<sub>z,r</sub> + w·M<sub>z,β</sub>, &nbsp; w = sat( (|β̂| − β<sub>lim</sub>/2) / (β<sub>lim</sub>/2) ), &nbsp; β<sub>lim</sub> = 2° + 6°·μ <span class="lbl">(M7)</span></div>
  <p><b>Clasificare</b>: supravirare dacă M<sub>z</sub>·r &lt; 0 (momentul se opune rotației) sau β depășește limita; altfel subvirare.
  <b>Alocarea</b>: M<sub>z</sub> &gt; 0 → roți stânga; supravirare → roata față (ΔF<sub>x</sub> = |M<sub>z</sub>|/(s/2)); subvirare → roata spate
  (max. 0,75·μF<sub>z</sub>), surplusul pe roata față de aceeași parte. Forța e transformată în <b>alunecare-țintă</b> prin inversarea
  curbei (M3) cu μ și F<sub>z</sub> estimate, apoi executată de regulatorul de alunecare. La limita de aderență, dacă cererea șoferului
  depășește limita fizică (r<sub>lin</sub> ≫ r), ESP plafonează cuplul motor la cel necesar menținerii vitezei (testul pe platforma circulară).</p>

  <h2 id="m7">7. Regulatoarele de alunecare (nivel 2)</h2>
  <div class="eq">ABS / frânare activă: &nbsp; p = p<sub>I</sub> + K<sub>p</sub>(λ* − λ), &nbsp; ṗ<sub>I</sub> = K<sub>i</sub>(λ* − λ), &nbsp;
  K ∝ μ̂ &nbsp;&nbsp; (λ*<sub>ABS</sub> = 0,05 + 0,07·μ̂, spate ×0,8, select-low)<br>
  TCS: &nbsp; T<sub>TCS</sub> = T<sub>I</sub> − K<sub>p</sub>·max(0, λ<sub>a</sub> − λ*<sub>a</sub>), &nbsp; λ*<sub>a</sub> = 0,03 + 0,05·μ̂ + Δλ<sub>ESP</sub>; BTC sub 60 km/h<br>
  EDTC: &nbsp; T<sub>min</sub> crește integral cât timp alunecarea de frânare a roților motoare depășește 0,02 + 0,04·μ̂ <span class="lbl">(M8)</span></div>

  <h2 id="m8">8. Modelul șoferului</h2>
  <p>În manevrele în buclă deschisă (S, slalom, volan fix, Sine with Dwell) unghiul de volan este o funcție de timp identică pentru
  ambele vehicule. „Drumul” este cursul definit de volan: giratia de referință, limitată la ce este realizabil fizic.
  În manevrele în buclă închisă (schimbare de bandă, platformă circulară, obstacol, μ-split), șoferul urmărește o traiectorie
  (algoritm <i>pure pursuit</i>, timp de anticipare 0,75–1 s, timp de reacție 0,15–0,25 s, viteză de rotire a volanului limitată la 400–700 °/s).</p>

  <h2 id="m9">9. Parametrii vehiculului</h2>
  <table>
    <tr><th>Parametru</th><th>Simbol</th><th>Valoare</th><th>Unitate</th></tr>
    ${row('Masă', 'm', p.mass, 'kg')}
    ${row('Moment de inerție la giratie', 'I<sub>z</sub>', p.yawInertia, 'kg·m²')}
    ${row('Distanța CG – punte față / spate', 'a / b', `${p.a} / ${p.b}`, 'm')}
    ${row('Ampatament', 'l', fmt(d.wheelbase, 2), 'm')}
    ${row('Ecartament', 's', p.trackFront, 'm')}
    ${row('Înălțimea CG', 'h', p.cgHeight, 'm')}
    ${row('Raport de direcție', 'i<sub>s</sub>', p.steeringRatio, '–')}
    ${row('Raza roții / inerția roții', 'R / I<sub>w</sub>', `${p.wheelRadius} / ${p.wheelInertia}`, 'm / kg·m²')}
    ${row('Sarcina statică pe roată față / spate', 'F<sub>z0</sub>', `${d.staticLoadFront} / ${d.staticLoadRear}`, 'N')}
    ${row('Rigiditate la derivă punte față / spate', 'C<sub>f</sub> / C<sub>r</sub>', `${fmt(d.corneringStiffFront, 0)} / ${fmt(d.corneringStiffRear, 0)}`, 'N/rad')}
    ${row('Gradient de subvirare', 'EG', fmt(d.understeerGradient * 1000, 3) + '·10⁻³', 's²/m')}
    ${row('Viteza caracteristică', 'v<sub>ch</sub>', fmt(d.characteristicSpeedKmh, 0), 'km/h')}
    ${row('Distribuția rigidității la ruliu (față)', 'φ<sub>f</sub>', p.rollStiffnessFront, '–')}
    ${row('Factori Pacejka', 'C / E', `${p.tireShapeC} / ${p.tireCurvatureE}`, '–')}
    ${row('Câștig frână față / spate', 'k<sub>fr</sub>', `${p.brakeGainFront} / ${p.brakeGainRear}`, 'N·m/bar')}
    ${row('Cuplu maxim la roți / putere', 'T<sub>max</sub> / P', `${p.maxWheelTorque} / ${p.enginePower / 1000}`, 'N·m / kW')}
    ${row('Aerodinamică', 'c<sub>x</sub>A', p.dragArea, 'm²')}
  </table>
  </article>`;
}

// ================================================================= DESPRE
export function renderAbout(host) {
  host.innerHTML = `<article>
  <h1>Despre aplicație</h1>
  <p class="lead">Aplicație web de simulare a Programului Electronic de Stabilitate, realizată pentru prezentarea universitară
  a capitolului ESP din <i>Automotive Mechatronics</i> (K. Reif, ed., Bosch Professional Automotive Information, Springer 2015).</p>

  <h2>Arhitectura</h2>
  <table>
    <tr><th>Proiect</th><th>Rol</th></tr>
    <tr><td><code>EspSim.Core</code></td><td>Bibliotecă .NET 10: modelul vehiculului (<code>Model/</code>), unitatea de control ESP cu regulatoarele
    ierarhice, EBD și starea supapelor modulatorului (<code>Control/</code>), simulatoarele secțiunii de frânare – ciclul ABS,
    distribuția forței de frânare, funcțiile automate (<code>Brakes/</code>), modelul șoferului (<code>Driver/</code>), biblioteca de manevre (<code>Scenarios/</code>) și bucla de
    simulare (<code>Simulation/</code>).</td></tr>
    <tr><td><code>EspSim.Web</code></td><td>ASP.NET Core (Minimal API) – expune simularea prin HTTP și servește interfața (HTML/CSS/JS, fără
    biblioteci externe: funcționează și fără internet, pe laptopul din sala de curs).</td></tr>
    <tr><td><code>EspSim.Validation</code></td><td>Program consolă de verificare: teste ale modelului de pneu și rularea tuturor manevrelor cu
    rezultatele așteptate (vehiculul fără ESP instabil, cel cu ESP stabil).</td></tr>
  </table>
  <h4>Fluxul unui pas de simulare</h4>
  <pre>Șofer (volan, pedale) ──► Unitate de control (la 10 ms):
                              senzori (+zgomot) → monitor → model referință → regulator ESP
                              → ABS / TCS / EDTC → presiuni-țintă, limite de cuplu
                         ──► Modulator hidraulic + motor (dinamică proprie)
                         ──► Model vehicul 7 GL (pas 0,5 ms) ──► înregistrare 50 Hz</pre>

  <h2>Interfața de programare (API)</h2>
  <table>
    <tr><th>Cerere</th><th>Descriere</th></tr>
    <tr><td><code>GET /api/scenarios</code></td><td>lista manevrelor, cu descriere și valori implicite</td></tr>
    <tr><td><code>GET /api/vehicle</code></td><td>parametrii vehiculului și ai regulatorului ESP</td></tr>
    <tr><td><code>GET /api/brakes/functions</code></td><td>lista funcțiilor automate de frânare (HBA, HFC, HRB, CDP, HHC, HDC, CDD, BDW)</td></tr>
    <tr><td><code>POST /api/brakes/abs-cycle</code></td><td>ciclul de reglare ABS pe modelul „sfert de vehicul” (cu / fără ABS)</td></tr>
    <tr><td><code>POST /api/brakes/distribution</code></td><td>diagrama de distribuție a forței de frânare: ideală, fixă, cu supapă, EBD, drepte de blocare</td></tr>
    <tr><td><code>POST /api/brakes/function/{id}</code></td><td>simularea unei funcții automate de frânare</td></tr>
    <tr><td><code>POST /api/simulate</code></td><td>rulează manevra pentru vehiculele A și B; corpul cererii: <code>scenarioId, speedKmh, mu,
    steeringScale, drivetrain, extraMassKg, systemsA, systemsB, tuning, sensorNoise, idealMu, swdMultiplier</code></td></tr>
  </table>

  <h2>Utilizare în prezentare</h2>
  <ul>
    <li><b>Spațiu</b> – redare/pauză; <b>← →</b> – pas cu pas; <b>Home</b> – de la început; <b>Ctrl+Enter</b> – rulează din nou.</li>
    <li>Click pe un grafic sau pe un eveniment din jurnal – salt la momentul respectiv. Toate graficele și scena sunt sincronizate.</li>
    <li>Redarea la 0,25× sau 0,1× permite urmărirea fazelor intervenției (ca în figurile din curs); opțiunea „poziții la 0,5 s” desenează
    vehiculul la intervale regulate, în stilul fig. 4 și 11.</li>
    <li>În panoul „Vehiculul”, comutatorul <b>Roți / Modulator</b> afișează starea live a celor 12 supape (IV, OV, USV, HSV) și a pompei
    pentru vehiculul selectat – se vede cum ESP, ABS, TCS și EBD folosesc aceeași hidraulică.</li>
    <li>Butonul <b>Prezentare</b> ascunde panoul de parametri; tema luminoasă este potrivită pentru videoproiector.</li>
    <li>Experimente sugerate: dezactivați ESP pe vehiculul B și activați doar TCS (slalom); schimbați tracțiunea în FWD la accelerarea în viraj;
    reduceți K<sub>p</sub> sau K<sub>β</sub> și observați cum ESP intervine prea târziu; activați zgomotul senzorilor.</li>
  </ul>

  <h2>Limitările modelului</h2>
  <ul>
    <li>Model plan: ruliul și tangajul sunt incluse doar prin transferul de sarcină cvasi-static; nu se modelează suspensia, elastocinematica,
    momentul de autoaliniere și relaxarea pneului.</li>
    <li>Pneul este un model empiric simplificat (Magic Formula normalizată); parametrii nu provin de la un pneu anume.</li>
    <li>Algoritmii ESP sunt o reconstrucție didactică a principiilor din curs – algoritmii de serie sunt proprietari și mult mai complecși
    (mii de parametri calibrați pentru fiecare model de vehicul).</li>
    <li>Cifrele (viteze limită, distanțe) sunt orientative; comparația cu/fără ESP și mecanismele de intervenție sunt cele relevante.</li>
  </ul>

  <h2>Bibliografie</h2>
  <ol>
    <li>K. Reif (ed.), <i>Automotive Mechatronics – Automotive Networking, Driving Stability Systems, Electronics</i>, Bosch Professional
    Automotive Information, Springer Vieweg, 2015 – cap. „Electronic stability program”, „Automatic brake functions”, „Hydraulic modulator”,
    „Sensotronic brake control”.</li>
    <li>H. B. Pacejka, <i>Tire and Vehicle Dynamics</i>, Butterworth-Heinemann.</li>
    <li>R. Rajamani, <i>Vehicle Dynamics and Control</i>, Springer.</li>
    <li>NHTSA, FMVSS No. 126 – Electronic Stability Control Systems; UN Regulation No. 140 (ESC).</li>
  </ol>
  </article>`;
}
