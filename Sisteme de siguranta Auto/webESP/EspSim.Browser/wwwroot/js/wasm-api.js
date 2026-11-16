// Înlocuiește serverul EspSim.Web: apelurile fetch('api/...') sunt rezolvate local,
// de modelul EspSim.Core compilat în WebAssembly. Restul interfeței rămâne neschimbat.
import { dotnet } from '../_framework/dotnet.js';

const ready = (async () => {
  const { getAssemblyExports, getConfig } = await dotnet.create();
  const exports = await getAssemblyExports(getConfig().mainAssemblyName);
  return exports.EspApi;
})();

const nativeFetch = window.fetch.bind(window);

function respond(text) {
  if (text.startsWith('!404 ')) {
    return new Response(JSON.stringify({ error: text.slice(5) }), { status: 404, statusText: 'Not Found', headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function route(path, init) {
  const api = await ready;
  const body = typeof init?.body === 'string' ? init.body : '';
  let m;
  if (path === 'scenarios') return respond(api.Scenarios());
  if (path === 'vehicle') return respond(api.Vehicle());
  if (path === 'simulate') return respond(api.Simulate(body));
  if (path === 'brakes/functions') return respond(api.BrakeFunctionList());
  if (path === 'brakes/abs-cycle') return respond(api.AbsCycleRun(body));
  if (path === 'brakes/distribution') return respond(api.Distribution(body));
  if ((m = path.match(/^brakes\/function\/([^/?#]+)$/))) return respond(api.BrakeFunction(decodeURIComponent(m[1]), body));
  if (path === 'health') return respond(JSON.stringify({ status: 'ok', version: '1.0', framework: 'WebAssembly (browser)' }));
  return new Response(JSON.stringify({ error: 'rută necunoscută: ' + path }), { status: 404, statusText: 'Not Found' });
}

window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input?.url ?? '';
  const m = url.match(/^(?:\.?\/)?api\/(.+)$/);
  if (!m) return nativeFetch(input, init);
  // simularea rulează sincron în WebAssembly; un tick de întârziere lasă interfața să se redeseneze
  return new Promise(r => setTimeout(r, 0)).then(() => route(m[1], init)).catch(e => {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, statusText: 'Eroare simulare' });
  });
};

ready.catch(e => {
  console.error(e);
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:auto 16px 16px 16px;padding:12px 16px;background:#c92a2a;color:#fff;border-radius:8px;z-index:9999;font:14px system-ui';
  div.textContent = 'Modelul de simulare (WebAssembly) nu a putut fi încărcat: ' + e;
  document.body.appendChild(div);
});
