const form = document.getElementById('run-form');
const output = document.getElementById('output');
const throwCanvas = document.getElementById('throw-canvas');
const velocityCanvas = document.getElementById('velocity-canvas');

const throwCtx = throwCanvas.getContext('2d');
const velocityCtx = velocityCanvas.getContext('2d');

function mapColor(value) {
  const v = Math.max(0, Math.min(1, value));
  const stops = [
    { t: 0.0, c: [26, 59, 214] },
    { t: 0.35, c: [26, 183, 229] },
    { t: 0.65, c: [45, 206, 67] },
    { t: 0.85, c: [230, 216, 51] },
    { t: 1.0, c: [243, 91, 56] },
  ];

  let i = 0;
  while (i < stops.length - 1 && v > stops[i + 1].t) i += 1;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const f = b.t === a.t ? 0 : (v - a.t) / (b.t - a.t);
  const color = a.c.map((ch, idx) => Math.round(ch + (b.c[idx] - ch) * f));
  return `rgb(${color[0]} ${color[1]} ${color[2]})`;
}

function drawMillShell(ctx, center, radius) {
  ctx.save();
  ctx.translate(center.x, center.y);

  ctx.fillStyle = '#ececec';
  ctx.beginPath();
  ctx.arc(0, 0, radius + 15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#9fa7b5';
  ctx.lineWidth = 3;
  ctx.stroke();

  const lifterCount = 42;
  for (let i = 0; i < lifterCount; i += 1) {
    const angle = (Math.PI * 2 * i) / lifterCount;
    const spread = Math.PI / lifterCount;
    const rOuter = radius + 10;
    const rInner = radius - 2;

    ctx.beginPath();
    ctx.moveTo(Math.cos(angle - spread) * rInner, Math.sin(angle - spread) * rInner);
    ctx.lineTo(Math.cos(angle) * rOuter, Math.sin(angle) * rOuter);
    ctx.lineTo(Math.cos(angle + spread) * rInner, Math.sin(angle + spread) * rInner);
    ctx.closePath();
    ctx.fillStyle = '#a7afbd';
    ctx.fill();
  }

  ctx.restore();
}

function drawNoDataMessage(message) {
  const { width, height } = throwCanvas;
  const center = { x: width / 2, y: height / 2 };
  const radius = 175;

  throwCtx.clearRect(0, 0, width, height);
  velocityCtx.clearRect(0, 0, width, height);
  drawMillShell(throwCtx, center, radius);
  drawMillShell(velocityCtx, center, radius);

  for (const ctx of [throwCtx, velocityCtx]) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(40, height / 2 - 36, width - 80, 72);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 12px Inter, system-ui, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, width / 2, height / 2);
    ctx.textAlign = 'start';
  }
}

function drawFromLiggghts(chargeThrow) {
  const { width, height } = throwCanvas;
  const center = { x: width / 2, y: height / 2 };

  const allPoints = [];
  for (const trajectory of chargeThrow.trajectories) {
    for (const point of trajectory.points) {
      allPoints.push(point);
    }
  }

  if (allPoints.length === 0) {
    drawNoDataMessage('No trajectory points in LIGGGHTS output.');
    return;
  }

  const maxExtent = Math.max(
    ...allPoints.map((point) => Math.max(Math.abs(point.x), Math.abs(point.y))),
    1,
  );
  const radius = 175;
  const scale = (radius * 0.96) / maxExtent;

  throwCtx.clearRect(0, 0, width, height);
  drawMillShell(throwCtx, center, radius);

  throwCtx.save();
  throwCtx.translate(center.x, center.y);
  for (const trajectory of chargeThrow.trajectories) {
    if (!trajectory.points || trajectory.points.length < 2) continue;
    throwCtx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    throwCtx.lineWidth = 1;
    throwCtx.beginPath();
    throwCtx.moveTo(trajectory.points[0].x * scale, trajectory.points[0].y * scale);
    for (const point of trajectory.points) {
      throwCtx.lineTo(point.x * scale, point.y * scale);
    }
    throwCtx.stroke();

    for (const point of trajectory.points) {
      throwCtx.fillStyle = mapColor(Math.min(point.speed / 8, 1));
      throwCtx.beginPath();
      throwCtx.arc(point.x * scale, point.y * scale, 1.2, 0, Math.PI * 2);
      throwCtx.fill();
    }
  }
  throwCtx.restore();

  const resolution = 64;
  const cells = new Array(resolution * resolution).fill(0);
  const counts = new Array(resolution * resolution).fill(0);
  const step = (radius * 2) / resolution;

  for (const trajectory of chargeThrow.trajectories) {
    for (const point of trajectory.points) {
      const sx = point.x * scale;
      const sy = point.y * scale;
      const ix = Math.floor((sx + radius) / step);
      const iy = Math.floor((sy + radius) / step);
      if (ix < 0 || iy < 0 || ix >= resolution || iy >= resolution) continue;
      const index = iy * resolution + ix;
      cells[index] += point.speed;
      counts[index] += 1;
    }
  }

  velocityCtx.clearRect(0, 0, width, height);
  velocityCtx.save();
  velocityCtx.translate(center.x - radius, center.y - radius);

  let maxValue = 0;
  for (let i = 0; i < cells.length; i += 1) {
    if (counts[i] > 0) {
      cells[i] /= counts[i];
      maxValue = Math.max(maxValue, cells[i]);
    }
  }

  for (let iy = 0; iy < resolution; iy += 1) {
    for (let ix = 0; ix < resolution; ix += 1) {
      const x = ix * step;
      const y = iy * step;
      const cx = x + step / 2 - radius;
      const cy = y + step / 2 - radius;
      if (Math.hypot(cx, cy) > radius) continue;

      const index = iy * resolution + ix;
      const value = maxValue > 0 ? cells[index] / maxValue : 0;
      velocityCtx.fillStyle = mapColor(Math.pow(value, 0.75));
      velocityCtx.fillRect(x, y, step + 0.5, step + 0.5);
    }
  }

  velocityCtx.restore();
  drawMillShell(velocityCtx, center, radius);

  throwCtx.fillStyle = '#334155';
  throwCtx.font = '600 12px Inter, system-ui, Arial, sans-serif';
  throwCtx.fillText(`LIGGGHTS trajectories | frames: ${chargeThrow.frame_count}`, 14, 20);
}

function readConfig() {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  for (const key of Object.keys(payload)) {
    payload[key] = Number(payload[key]);
  }
  return payload;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = readConfig();

  output.textContent = 'Submitting run...';

  try {
    const response = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    output.textContent = JSON.stringify(data, null, 2);
    if (!response.ok) {
      drawNoDataMessage('Run failed before LIGGGHTS trajectory extraction.');
      return;
    }

    if (data.charge_throw?.source === 'liggghts') {
      drawFromLiggghts(data.charge_throw);
      return;
    }

    drawNoDataMessage(data.charge_throw?.message || 'No LIGGGHTS trajectory data available.');
  } catch (error) {
    output.textContent = `Request failed: ${error}`;
    drawNoDataMessage('Request failed; no LIGGGHTS data available.');
  }
});

drawNoDataMessage('Run LIGGGHTS to generate charge throw and velocity output.');
