(() => {
  const mode = document.getElementById('rc-mode');
  const resistance = document.getElementById('rc-resistance');
  const capacitance = document.getElementById('rc-capacitance');
  const voltage = document.getElementById('rc-voltage');
  const time = document.getElementById('rc-time');
  const play = document.getElementById('rc-play');
  const error = document.getElementById('rc-error');
  const output = document.getElementById('rc-output');
  const curve = document.getElementById('rc-curve');
  const marker = document.getElementById('rc-marker');
  let animation = null;
  let animationStart = null;
  let startProgress = 0;

  function format(value) {
    if (value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 1000000)) {
      return value.toExponential(3).replace('.', ',');
    }
    return new Intl.NumberFormat('ro-RO', { maximumSignificantDigits: 4 }).format(value);
  }

  function stop() {
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
    animationStart = null;
    play.textContent = 'Pornește animația';
  }

  function update() {
    if (![resistance, capacitance, voltage].every(input => input.validity.valid && input.value !== '' && Number.isFinite(input.valueAsNumber))) {
      stop();
      error.textContent = 'Introdu valori valide: R și C între 0,001 și 1.000.000; tensiunea între 0,01 și 1.000 V.';
      error.hidden = false;
      output.hidden = true;
      return false;
    }
    error.hidden = true;
    output.hidden = false;
    const r = resistance.valueAsNumber;
    const c = capacitance.valueAsNumber;
    const u = voltage.valueAsNumber;
    const tau = r * c / 1000;
    const t = Number(time.value);
    const charging = mode.value === 'charge';
    const fraction = x => charging ? 1 - Math.exp(-x) : Math.exp(-x);
    const show = (id, value) => { document.getElementById(id).textContent = value; };

    show('rc-tau', `${format(tau)} s`);
    show('rc-observed-time', `${format(t * tau)} s (${format(t)}τ)`);
    show('rc-observed-voltage', `${format(u * fraction(t))} V (${format(100 * fraction(t))}%)`);
    show('rc-current', `${format((charging ? 1 : -1) * u / r * Math.exp(-t))} mA`);
    show('rc-target-label', charging ? 'Timp până la 90% / 99%' : 'Timp până la 10% / 1%');
    show('rc-target', `${format(Math.log(10) * tau)} s / ${format(Math.log(100) * tau)} s`);

    const x = value => 55 + value * 111;
    const y = value => 240 - value * 220;
    const points = [];
    for (let i = 0; i <= 100; i++) {
      const step = i / 20;
      points.push(`${i === 0 ? 'M' : 'L'}${x(step)} ${y(fraction(step))}`);
    }
    curve.setAttribute('d', points.join(' '));
    marker.setAttribute('cx', x(t));
    marker.setAttribute('cy', y(fraction(t)));
    return true;
  }

  function animate(timestamp) {
    if (animationStart === null) animationStart = timestamp;
    time.value = Math.min(5, startProgress + (timestamp - animationStart) / 2000);
    if (!update()) return;
    if (Number(time.value) >= 5) {
      stop();
    } else {
      animation = requestAnimationFrame(animate);
    }
  }

  [resistance, capacitance, voltage].forEach(input => input.addEventListener('input', update));
  time.addEventListener('input', () => { stop(); update(); });
  mode.addEventListener('change', () => { stop(); time.value = 0; update(); });
  play.addEventListener('click', () => {
    if (animation !== null) {
      stop();
    } else if (update()) {
      if (Number(time.value) >= 5) time.value = 0;
      startProgress = Number(time.value);
      play.textContent = 'Pauză';
      animation = requestAnimationFrame(animate);
    }
  });
  update();
})();
