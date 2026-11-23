// Interfața tabloului: conectare la serverul local sau la modelul din browser.
(() => {
  const $ = (id) => document.getElementById(id);
  const fmt = (v, d = 1) => Number(v).toFixed(d).replace(".", ",");
  let ws = null, worker = null, workerReady = false, S = null, built = false;

  // ---------------- instrumente
  const G = {
    f: new Gauge($("m_f"), { title: "FRECVENȚĂ", unit: "Hz", min: 44, max: 56, step: 2, minor: 4, decimals: 2,
      zones: [{ from: 44, to: 45, color: "#d1201b" }, { from: 45, to: 47.5, color: "#f0a020" },
              { from: 52.5, to: 55, color: "#f0a020" }, { from: 55, to: 56, color: "#d1201b" }] }),
    rpm: new Gauge($("m_rpm"), { title: "TURAȚIE MOTOR", unit: "rot/min", min: 0, max: 1800, step: 300, minor: 3,
      zones: [{ from: 1725, to: 1800, color: "#d1201b" }] }),
    kw: new Gauge($("m_kw"), { title: "PUTERE ACTIVĂ", unit: "kW", min: 0, max: 500, step: 100, minor: 5,
      zones: [{ from: 400, to: 500, color: "#d1201b" }] }),
    a: new Gauge($("m_a"), { title: "CURENT", unit: "A", min: 0, max: 1000, step: 200, minor: 4,
      zones: [{ from: 722, to: 1000, color: "#d1201b" }] }),
    v: new Gauge($("m_v"), { title: "TENSIUNE", unit: "V", min: 0, max: 500, step: 100, minor: 5,
      zones: [{ from: 360, to: 420, color: "#2f9e62" }] }),
    cos: new Gauge($("m_cos"), { title: "FACTOR DE PUTERE", unit: "cos φ", min: 0.5, max: 1.0, step: 0.1, minor: 5, decimals: 2,
      fmt: (v) => v.toFixed(1) }),
  };

  // ---------------- conexiune
  function send(o) {
    if (worker && workerReady) worker.postMessage(o);
    else if (ws && ws.readyState === 1) ws.send(JSON.stringify(o));
  }
  function connect() {
    if (location.pathname.endsWith("/static/index.html")) {
      $("conn").textContent = "● se încarcă simulatorul…";
      worker = new Worker(new URL("simulation-worker.js", document.baseURI));
      worker.onmessage = (ev) => {
        if (ev.data.type === "ready") {
          workerReady = true;
          $("conn").textContent = "● simulator în browser";
          $("conn").classList.add("ok");
        } else if (ev.data.type === "state") {
          S = ev.data.state;
          if (!built) build(S);
          render(S);
        } else if (ev.data.type === "error") {
          workerReady = false;
          $("conn").textContent = "● eroare la încărcarea simulatorului; reîncarcă pagina";
          $("conn").classList.remove("ok");
          console.error(ev.data.message);
        }
      };
      worker.onerror = (ev) => {
        workerReady = false;
        $("conn").textContent = "● eroare la încărcarea simulatorului; reîncarcă pagina";
        $("conn").classList.remove("ok");
        console.error(ev.message);
      };
      return;
    }
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => { $("conn").textContent = "● conectat"; $("conn").classList.add("ok"); };
    ws.onclose = () => { $("conn").textContent = "● deconectat – reîncerc…"; $("conn").classList.remove("ok"); setTimeout(connect, 1500); };
    ws.onmessage = (ev) => { S = JSON.parse(ev.data); if (!built) build(S); render(S); };
  }

  // ---------------- butoane fixe
  document.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", () => send({ cmd: b.dataset.cmd })));
  $("reset").onclick = () => { send({ cmd: "reset_sim" }); trend.length = 0; };
  $("speed").onchange = (e) => send({ cmd: "speed", value: parseFloat(e.target.value) });
  $("modeKnob").onclick = () => send({ cmd: "mode", value: S && S.mode === "droop" ? "iso" : "droop" });
  $("droop").oninput = (e) => { $("droopVal").textContent = fmt(e.target.value) + " %"; send({ cmd: "droop", value: parseFloat(e.target.value) }); };
  $("anticip").onchange = (e) => send({ cmd: "anticip", value: e.target.checked });
  function hold(btn, val) {
    const on = (e) => { e.preventDefault(); btn.classList.add("pressed"); send({ cmd: "raise", value: val }); };
    const off = () => { if (btn.classList.contains("pressed")) { btn.classList.remove("pressed"); send({ cmd: "raise", value: 0 }); } };
    btn.addEventListener("pointerdown", on);
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, off));
  }
  hold($("btnRaise"), 1); hold($("btnLower"), -1);

  // ---------------- construcția modulelor de consumatori și a anunțiatorului
  function build(s) {
    const row = $("feeders");
    row.innerHTML = "";
    for (const L of s.loads) {
      const d = document.createElement("div");
      d.className = "feeder"; d.id = "fd_" + L.id;
      const tag = L.stage ? `NEESENȚIAL · T${L.stage}` : (L.group === "esential" ? "ESENȚIAL" : "CONSUMATOR MARE");
      d.innerHTML = `
        <div class="fplate">${L.name.toUpperCase()}</div>
        <div class="kw">${L.kw} kW</div>
        <div class="tag">${tag}</div>
        <div class="mini"><div></div></div>
        <div class="flamps">
          <label><span class="lamp green"></span>FUNCȚ.</label>
          <label><span class="lamp amber"></span>DECL.</label>
        </div>
        ${L.kind === "drive" ? `<input type="range" min="0" max="100" step="5" value="100" aria-label="Comandă thruster"><div class="dem">COMANDĂ 100 %</div>` : ""}
        <div class="fbtn">
          <button class="pb green">START</button>
          <button class="pb red">STOP</button>
        </div>`;
      row.appendChild(d);
      const [bs, bp] = d.querySelectorAll(".pb");
      bs.onclick = () => send({ cmd: "feeder_start", id: L.id });
      bp.onclick = () => send({ cmd: "feeder_stop", id: L.id });
      const rg = d.querySelector("input[type=range]");
      if (rg) rg.oninput = () => { d.querySelector(".dem").textContent = `COMANDĂ ${rg.value} %`; send({ cmd: "demand", id: L.id, value: rg.value / 100 }); };
    }
    const ann = $("ann");
    ann.innerHTML = "";
    for (const a of s.alarms) {
      const t = document.createElement("div");
      t.className = "tile" + (["SL", "HL", "PT1", "PT2", "OL"].includes(a.code) ? " warn" : "");
      t.id = "al_" + a.code; t.textContent = a.text;
      ann.appendChild(t);
    }
    built = true;
  }

  // ---------------- redare
  const trend = [];
  function lamp(id, on, blink) { const e = typeof id === "string" ? $(id) : id; e.classList.toggle("on", !!on); e.classList.toggle("blink", !!blink); }

  function render(s) {
    $("clock").textContent = "t = " + fmt(s.t, 1) + " s";
    G.f.set(s.f); G.rpm.set(s.rpm); G.kw.set(Math.max(0, s.p_kw)); G.a.set(s.i_a); G.v.set(s.v);
    G.cos.set(s.acb && s.p_kw > 1 ? Math.max(0.5, s.cos) : 1.0);
    lamp("l_run", s.engine && !s.starting); lamp("l_start", s.starting, true);
    lamp("l_acb", s.acb); lamp("l_acbo", !s.acb && s.engine);
    $("modeKnob").classList.toggle("iso", s.mode === "iso");
    $("lbl_droop").classList.toggle("act", s.mode === "droop"); $("lbl_iso").classList.toggle("act", s.mode === "iso");
    if (document.activeElement !== $("droop")) { $("droop").value = s.droop; $("droopVal").textContent = fmt(s.droop) + " %"; }
    $("droop").disabled = s.mode === "iso";
    $("anticip").checked = s.anticip;
    $("r_f0").textContent = fmt(s.f_noload, 2) + " Hz";
    $("r_rack").textContent = fmt(s.rack, 1) + " %";
    $("r_boost").textContent = fmt(s.boost, 2) + " bar";
    $("r_exh").textContent = fmt(s.t_exh, 0) + " °C";
    $("r_lo").textContent = fmt(s.lo_p, 1) + " bar";
    lamp("l_sl", s.fuel_limited);
    $("rackfill").style.width = Math.min(100, s.rack / 1.1) + "%";
    $("busbar").classList.toggle("live", s.acb);
    for (const L of s.loads) {
      const d = $("fd_" + L.id); if (!d) continue;
      d.classList.toggle("live", s.acb);
      const [lr, lt] = d.querySelectorAll(".lamp");
      lamp(lr, L.on, L.start); lamp(lt, L.tripped);
      const share = L.on ? (L.kind === "drive" ? L.demand : 1) : 0;
      d.querySelector(".mini div").style.width = (share * 100) + "%";
    }
    let unack = false;
    for (const a of s.alarms) {
      const t = $("al_" + a.code); if (!t) continue;
      t.classList.toggle("on", a.active || (!a.acked && a.latched));
      t.classList.toggle("unack", !a.acked);
      t.classList.toggle("latched", !a.active && a.latched && a.acked);
      if (!a.acked) unack = true;
    }
    horn(unack && $("horn").checked);
    $("log").textContent = s.events.slice().reverse().join("\n");
    trend.push([s.t, s.f, s.p_kw, s.rack]);
    while (trend.length && s.t - trend[0][0] > 60) trend.shift();
    if (trend.length && s.t < trend[trend.length - 1][0]) trend.length = 0;
    drawTrend();
  }

  // ---------------- înregistrator (trei benzi cu axe proprii)
  const cv = $("trend"), cx = cv.getContext("2d");
  function drawTrend() {
    const W = cv.width, H = cv.height, L = 44, R = 10, top = 8;
    cx.clearRect(0, 0, W, H);
    if (!trend.length) return;
    const tN = trend[trend.length - 1][0], t0 = tN - 60;
    const X = (t) => L + (t - t0) / 60 * (W - L - R);
    const bands = [
      { h: 150, min: 44, max: 56, step: 2, col: "#2a78d6", idx: 1, unit: "Hz", lim: [45, 55] },
      { h: 80, min: 0, max: 500, step: 100, col: "#eb6834", idx: 2, unit: "kW", lim: [400] },
      { h: 70, min: 0, max: 110, step: 50, col: "#2f9e62", idx: 3, unit: "%" },
    ];
    let y0 = top;
    cx.font = "10px DejaVu Sans, Arial"; cx.textBaseline = "middle";
    for (const b of bands) {
      const Y = (v) => y0 + b.h - (Math.min(b.max, Math.max(b.min, v)) - b.min) / (b.max - b.min) * b.h;
      cx.strokeStyle = "#26303a"; cx.lineWidth = 1; cx.fillStyle = "#8f9aa4"; cx.textAlign = "right";
      for (let v = b.min; v <= b.max + 1e-9; v += b.step) {
        cx.beginPath(); cx.moveTo(L, Y(v)); cx.lineTo(W - R, Y(v)); cx.stroke();
        cx.fillText(String(v), L - 6, Y(v));
      }
      cx.save(); cx.translate(10, y0 + b.h / 2); cx.rotate(-Math.PI / 2); cx.textAlign = "center"; cx.fillText(b.unit, 0, 0); cx.restore();
      if (b.lim) { cx.setLineDash([4, 3]); cx.strokeStyle = "#8a939b"; for (const v of b.lim) { cx.beginPath(); cx.moveTo(L, Y(v)); cx.lineTo(W - R, Y(v)); cx.stroke(); } cx.setLineDash([]); }
      cx.strokeStyle = b.col; cx.lineWidth = 2; cx.beginPath();
      trend.forEach((p, i) => { const x = X(p[0]), y = Y(p[b.idx]); i ? cx.lineTo(x, y) : cx.moveTo(x, y); });
      cx.stroke();
      y0 += b.h + 10;
    }
    cx.fillStyle = "#8f9aa4"; cx.textAlign = "center";
    for (let k = 0; k <= 60; k += 10) { cx.textAlign = k === 60 ? "right" : "center"; cx.fillText(k === 60 ? "acum" : `−${60 - k} s`, X(t0 + k), H - 6); }
  }

  // ---------------- sirenă (Web Audio)
  let actx = null, osc = null;
  function horn(on) {
    if (on && !osc) {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      osc = actx.createOscillator(); const g = actx.createGain(); g.gain.value = 0.04;
      osc.type = "square"; osc.frequency.value = 750; osc.connect(g).connect(actx.destination); osc.start();
      osc._t = setInterval(() => { if (osc) osc.frequency.value = osc.frequency.value === 750 ? 600 : 750; }, 400);
    } else if (!on && osc) { clearInterval(osc._t); osc.stop(); osc = null; }
  }

  connect();
})();
