// Rulează modelul Python existent în browser, fără a bloca interfața.
let pyodide;
let speed = 1;
let last;
let timer;

function fail(error) {
  clearInterval(timer);
  postMessage({ type: "error", message: String(error) });
}

async function start() {
  importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");
  pyodide = await loadPyodide();
  const response = await fetch("../sim/model.py");
  if (!response.ok) throw new Error(`Modelul nu poate fi încărcat: HTTP ${response.status}`);
  pyodide.FS.writeFile("model.py", await response.text());
  pyodide.runPython("import json\nfrom model import Simulation\nsim = Simulation()");
  last = performance.now();
  postMessage({ type: "ready" });
  timer = setInterval(() => {
    try {
      const now = performance.now();
      const dt = Math.min(0.2, (now - last) / 1000) * speed;
      last = now;
      pyodide.runPython(`sim.step(${dt})`);
      postMessage({ type: "state", state: JSON.parse(pyodide.runPython("json.dumps(sim.state())")) });
    } catch (error) {
      fail(error);
    }
  }, 50);
}

onmessage = (event) => {
  try {
    if (event.data.cmd === "speed") {
      speed = Math.max(0, Math.min(4, Number(event.data.value)));
    } else {
      const json = JSON.stringify(event.data);
      pyodide.runPython(`sim.command(json.loads(${JSON.stringify(json)}))`);
    }
  } catch (error) {
    fail(error);
  }
};

start().catch(fail);
