(() => {
  const K_NC = 8.9875517923;
  const SOFT = 0.02;
  const SIZE = 640;
  const GRID = 100;
  const $ = id => document.getElementById(id);
  const canvas = $('electric-canvas');
  const ctx = canvas.getContext('2d');
  const background = document.createElement('canvas');
  background.width = SIZE;
  background.height = SIZE;
  const bg = background.getContext('2d');
  const heat = document.createElement('canvas');
  heat.width = GRID + 1;
  heat.height = GRID + 1;
  const heatCtx = heat.getContext('2d');
  const options = ['show-field', 'show-vectors', 'show-potential', 'show-contours', 'show-lines', 'show-forces'];
  let charges = [];
  let selected = null;
  let dragging = null;

  const px = x => (x + 1) * SIZE / 2;
  const py = y => (1 - y) * SIZE / 2;
  const signed = value => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1).replace('.', ',')}`;
  const scientific = value => value.toExponential(2).replace('.', ',');

  function field(x, y, exclude = -1) {
    let ex = 0, ey = 0, potential = 0;
    charges.forEach((charge, i) => {
      if (i === exclude) return;
      const dx = x - charge.x, dy = y - charge.y;
      const r2 = Math.max(dx * dx + dy * dy, SOFT * SOFT);
      const factor = K_NC * charge.q / (r2 * Math.sqrt(r2));
      ex += factor * dx;
      ey += factor * dy;
      potential += K_NC * charge.q / Math.sqrt(r2);
    });
    return { ex, ey, potential };
  }

  function forces() {
    return charges.map((charge, i) => {
      const e = field(charge.x, charge.y, i);
      const fx = charge.q * 1e-9 * e.ex, fy = charge.q * 1e-9 * e.ey;
      return { fx, fy, magnitude: Math.hypot(fx, fy), angle: Math.atan2(fy, fx) * 180 / Math.PI };
    });
  }

  function arrow(context, x1, y1, x2, y2, color, width = 2) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 7;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.moveTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45));
    context.lineTo(x2, y2);
    context.lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45));
    context.stroke();
  }

  function calculateGrid() {
    const cells = [];
    const magnitudes = [], potentials = [];
    for (let row = 0; row <= GRID; row++) {
      const line = [];
      for (let col = 0; col <= GRID; col++) {
        const value = field(-1 + 2 * col / GRID, 1 - 2 * row / GRID);
        value.magnitude = Math.hypot(value.ex, value.ey);
        line.push(value);
        magnitudes.push(value.magnitude);
        potentials.push(Math.abs(value.potential));
      }
      cells.push(line);
    }
    potentials.sort((a, b) => a - b);
    return { cells, maxE: Math.max(...magnitudes), maxV: potentials[Math.floor(potentials.length * 0.95)] || 1 };
  }

  function drawHeat(grid) {
    const fieldVisible = $('show-field').checked;
    const potentialVisible = $('show-potential').checked;
    if (!fieldVisible && !potentialVisible) return;
    const image = heatCtx.createImageData(GRID + 1, GRID + 1);
    for (let y = 0; y <= GRID; y++) {
      for (let x = 0; x <= GRID; x++) {
        const cell = grid.cells[y][x];
        let color = [255, 255, 255];
        if (fieldVisible && grid.maxE > 0) {
          const ratio = Math.max(0, Math.min(1, (Math.log10(Math.max(cell.magnitude, grid.maxE * 1e-4) / grid.maxE) + 4) / 4));
          color = [Math.round(30 + 225 * ratio), Math.round(15 + 170 * ratio * ratio), Math.round(65 - 45 * ratio)];
        }
        if (potentialVisible) {
          const ratio = Math.max(-1, Math.min(1, cell.potential / grid.maxV));
          const strength = Math.abs(ratio);
          const potentialColor = ratio >= 0
            ? [255, 255 - 175 * strength, 255 - 175 * strength]
            : [255 - 175 * strength, 255 - 135 * strength, 255];
          const alpha = fieldVisible ? 0.6 : 1;
          color = color.map((v, i) => Math.round(v * (1 - alpha) + potentialColor[i] * alpha));
        }
        const index = (y * (GRID + 1) + x) * 4;
        image.data.set([...color, 255], index);
      }
    }
    heatCtx.putImageData(image, 0, 0);
    bg.imageSmoothingEnabled = true;
    bg.drawImage(heat, 0, 0, SIZE, SIZE);
  }

  function drawContours(grid) {
    bg.strokeStyle = $('show-field').checked && !$('show-potential').checked ? 'rgba(255,255,255,.7)' : 'rgba(20,30,40,.55)';
    bg.lineWidth = 0.8;
    for (let levelIndex = -6; levelIndex <= 6; levelIndex++) {
      const level = grid.maxV * levelIndex / 6;
      bg.beginPath();
      for (let row = 0; row < GRID; row++) {
        for (let col = 0; col < GRID; col++) {
          const points = [
            [col, row, grid.cells[row][col].potential],
            [col + 1, row, grid.cells[row][col + 1].potential],
            [col + 1, row + 1, grid.cells[row + 1][col + 1].potential],
            [col, row + 1, grid.cells[row + 1][col].potential]
          ];
          const intersections = [];
          for (let i = 0; i < 4; i++) {
            const a = points[i], b = points[(i + 1) % 4];
            if ((a[2] < level) === (b[2] < level)) continue;
            const t = (level - a[2]) / (b[2] - a[2]);
            intersections.push([(a[0] + t * (b[0] - a[0])) * SIZE / GRID, (a[1] + t * (b[1] - a[1])) * SIZE / GRID]);
          }
          for (let i = 0; i + 1 < intersections.length; i += 2) {
            bg.moveTo(...intersections[i]);
            bg.lineTo(...intersections[i + 1]);
          }
        }
      }
      bg.stroke();
    }
  }

  function drawVectors(grid) {
    const color = $('show-field').checked && !$('show-potential').checked ? '#fff' : '#126a56';
    for (let row = 5; row < GRID; row += 6) {
      for (let col = 5; col < GRID; col += 6) {
        const e = grid.cells[row][col];
        if (e.magnitude < 1e-12) continue;
        const x = col * SIZE / GRID, y = row * SIZE / GRID;
        arrow(bg, x - 9 * e.ex / e.magnitude, y + 9 * e.ey / e.magnitude,
          x + 9 * e.ex / e.magnitude, y - 9 * e.ey / e.magnitude, color, 1.3);
      }
    }
  }

  function direction(x, y, sign) {
    const e = field(x, y);
    const magnitude = Math.hypot(e.ex, e.ey);
    return magnitude < 1e-12 ? [0, 0] : [sign * e.ex / magnitude, sign * e.ey / magnitude];
  }

  function drawFieldLines() {
    const positive = charges.reduce((sum, c) => sum + Math.max(c.q, 0), 0);
    const negative = charges.reduce((sum, c) => sum + Math.max(-c.q, 0), 0);
    const sign = positive >= negative ? 1 : -1;
    const largest = Math.max(...charges.map(c => Math.abs(c.q)));
    const color = $('show-field').checked && !$('show-potential').checked ? '#fff' : '#202a35';
    charges.forEach((charge, origin) => {
      if (Math.sign(charge.q) !== sign) return;
      const count = Math.max(4, Math.round(16 * Math.abs(charge.q) / largest));
      for (let n = 0; n < count; n++) {
        const angle = (n + 0.5) * 2 * Math.PI / count;
        let x = charge.x + 0.03 * Math.cos(angle), y = charge.y + 0.03 * Math.sin(angle);
        const points = [[px(x), py(y)]];
        const step = 0.012;
        for (let i = 0; i < 500; i++) {
          const a = direction(x, y, sign);
          if (a[0] === 0 && a[1] === 0) break;
          const b = direction(x + step * a[0] / 2, y + step * a[1] / 2, sign);
          const c = direction(x + step * b[0] / 2, y + step * b[1] / 2, sign);
          const d = direction(x + step * c[0], y + step * c[1], sign);
          x += step * (a[0] + 2 * b[0] + 2 * c[0] + d[0]) / 6;
          y += step * (a[1] + 2 * b[1] + 2 * c[1] + d[1]) / 6;
          points.push([px(x), py(y)]);
          if (Math.abs(x) > 1.05 || Math.abs(y) > 1.05 ||
              charges.some((other, j) => (j !== origin || i > 20) && Math.hypot(x - other.x, y - other.y) < 0.025)) break;
        }
        bg.beginPath();
        bg.moveTo(...points[0]);
        points.slice(1).forEach(point => bg.lineTo(...point));
        bg.strokeStyle = color;
        bg.lineWidth = 1;
        bg.stroke();
        const i = Math.floor(points.length / 3);
        if (i > 0 && i + 1 < points.length) {
          const a = points[i], b = points[i + 1];
          const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
          if (length > 0) arrow(bg, a[0], a[1], a[0] + sign * dx / length * 9, a[1] + sign * dy / length * 9, color, 1);
        }
      }
    });
  }

  function drawCharges() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(background, 0, 0);
    const allForces = forces();
    const maxForce = Math.max(0, ...allForces.map(f => f.magnitude));
    if ($('show-forces').checked && maxForce > 0) {
      charges.forEach((charge, i) => {
        const f = allForces[i];
        if (!f.magnitude) return;
        const length = 25 + 70 * Math.sqrt(f.magnitude / maxForce);
        arrow(ctx, px(charge.x), py(charge.y), px(charge.x) + length * f.fx / f.magnitude,
          py(charge.y) - length * f.fy / f.magnitude, '#098739', 3);
      });
    }
    charges.forEach((charge, i) => {
      const x = px(charge.x), y = py(charge.y);
      ctx.beginPath();
      ctx.arc(x, y, 12 + Math.min(Math.abs(charge.q), 10) * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = charge.q > 0 ? '#d62728' : '#1f5bd6';
      ctx.fill();
      ctx.strokeStyle = i === selected ? '#f5bc00' : '#111';
      ctx.lineWidth = i === selected ? 4 : 1;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 19px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(charge.q > 0 ? '+' : '−', x, y);
    });
  }

  function updateTable() {
    const allForces = forces();
    $('charge-rows').replaceChildren();
    charges.forEach((charge, i) => {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `#${i + 1}`;
      button.dataset.index = i;
      button.setAttribute('aria-label', `Selectează sarcina ${i + 1}`);
      button.setAttribute('aria-pressed', String(i === selected));
      cell.append(button);
      row.append(cell);
      const force = allForces[i];
      [signed(charge.q), charge.x.toFixed(2), charge.y.toFixed(2), scientific(force.magnitude),
        `${force.magnitude ? Math.round(force.angle) : 0}°`].forEach(value => {
        const td = document.createElement('td');
        td.textContent = value;
        row.append(td);
      });
      $('charge-rows').append(row);
    });
    $('charge-total').textContent = charges.length
      ? `Sarcina totală: ${signed(charges.reduce((sum, c) => sum + c.q, 0))} nC.`
      : 'Nicio sarcină. Adaugă una pe diagramă sau alege o configurație.';
    const hasSelection = selected !== null;
    $('selection-label').textContent = hasSelection ? `Sarcina #${selected + 1}` : 'Selectează o sarcină din diagramă sau din tabel.';
    $('selected-charge').disabled = !hasSelection;
    $('apply-charge').disabled = !hasSelection;
    $('delete-charge').disabled = !hasSelection;
    $('selected-charge').value = hasSelection ? charges[selected].q : '';
    $('charge-error').hidden = true;
  }

  function render() {
    bg.fillStyle = '#fff';
    bg.fillRect(0, 0, SIZE, SIZE);
    if (charges.length) {
      const grid = calculateGrid();
      drawHeat(grid);
      if ($('show-contours').checked) drawContours(grid);
      if ($('show-vectors').checked) drawVectors(grid);
      if ($('show-lines').checked) drawFieldLines();
      const scales = [];
      if ($('show-field').checked) scales.push(grid.maxE > 0
        ? `|E|: scară logaritmică ${scientific(grid.maxE * 1e-4)}–${scientific(grid.maxE)} V/m (culori închise → deschise)`
        : '|E|: câmp nul pe grilă');
      if ($('show-potential').checked) scales.push(`V: albastru negativ, alb zero, roșu pozitiv; limita culorii ±${scientific(grid.maxV)} V`);
      if ($('show-field').checked && $('show-potential').checked) scales.push('Culorile celor două hărți sunt suprapuse');
      $('field-scale').textContent = scales.join('. ') + (scales.length ? '.' : '');
    } else {
      $('field-scale').textContent = '';
    }
    $('field-status').textContent = 'Deplasează cursorul peste diagramă pentru a vedea câmpul și potențialul.';
    drawCharges();
    updateTable();
  }

  function preset(values) {
    charges = values.map(([x, y, q]) => ({ x, y, q }));
    selected = null;
    render();
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)),
      y: Math.max(-1, Math.min(1, 1 - (event.clientY - rect.top) / rect.height * 2))
    };
  }

  function nearest(x, y) {
    let best = null, distance = 0.06;
    charges.forEach((charge, i) => {
      const d = Math.hypot(x - charge.x, y - charge.y);
      if (d < distance) { best = i; distance = d; }
    });
    return best;
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    const p = point(event);
    const index = nearest(p.x, p.y);
    if (index !== null) {
      selected = index;
      dragging = index;
      canvas.setPointerCapture(event.pointerId);
      drawCharges();
      updateTable();
    } else {
      const q = Number($('new-charge').value);
      if (q === 0) {
        $('field-status').textContent = 'Alege o sarcină nouă diferită de zero.';
        return;
      }
      charges.push({ x: p.x, y: p.y, q });
      selected = charges.length - 1;
      render();
    }
  });
  canvas.addEventListener('pointermove', event => {
    const p = point(event);
    if (dragging !== null) {
      charges[dragging].x = p.x;
      charges[dragging].y = p.y;
      drawCharges();
      return;
    }
    const e = field(p.x, p.y);
    $('field-status').textContent = `x = ${p.x.toFixed(3)} m, y = ${p.y.toFixed(3)} m · |E| = ${scientific(Math.hypot(e.ex, e.ey))} V/m · Ex = ${scientific(e.ex)}, Ey = ${scientific(e.ey)} V/m · V = ${scientific(e.potential)} V`;
  });
  function finishDrag() {
    if (dragging === null) return;
    dragging = null;
    render();
  }
  canvas.addEventListener('pointerup', finishDrag);
  canvas.addEventListener('pointercancel', finishDrag);
  canvas.addEventListener('lostpointercapture', finishDrag);

  options.forEach(id => $(id).addEventListener('change', render));
  $('new-charge').addEventListener('input', event => {
    $('new-charge-value').textContent = `${signed(Number(event.target.value))} nC`;
  });
  $('preset-dipole').addEventListener('click', () => preset([[-0.3, 0, 4], [0.3, 0, -4]]));
  $('preset-quadrupole').addEventListener('click', () => preset([[-0.3, -0.3, 3], [0.3, -0.3, -3], [0.3, 0.3, 3], [-0.3, 0.3, -3]]));
  $('preset-capacitor').addEventListener('click', () => {
    const values = [];
    for (let i = 0; i < 9; i++) values.push([-0.6 + i * 0.15, 0.3, 1]);
    for (let i = 0; i < 9; i++) values.push([-0.6 + i * 0.15, -0.3, -1]);
    preset(values);
  });
  $('clear-charges').addEventListener('click', () => preset([]));
  $('charge-rows').addEventListener('click', event => {
    const button = event.target.closest('button[data-index]');
    if (!button) return;
    selected = Number(button.dataset.index);
    drawCharges();
    updateTable();
    $('selected-charge').focus();
  });
  $('apply-charge').addEventListener('click', () => {
    if (selected === null) return;
    const input = $('selected-charge');
    const q = input.valueAsNumber;
    if (!input.validity.valid || !Number.isFinite(q) || q === 0) {
      $('charge-error').hidden = false;
      return;
    }
    charges[selected].q = q;
    render();
  });
  $('delete-charge').addEventListener('click', () => {
    if (selected === null) return;
    charges.splice(selected, 1);
    selected = null;
    render();
  });
  preset([[-0.3, 0, 4], [0.3, 0, -4]]);
})();
