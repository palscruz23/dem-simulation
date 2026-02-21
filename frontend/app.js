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

function generateChargeModel(config) {
  const radius = 175;
  const omega = (config.rpm * 2 * Math.PI) / 60;
  const revolutionTime = 60 / Math.max(config.rpm, 0.1);
  const fillAngle = Math.max(0.25, Math.min(0.95, config.media_fill_fraction)) * Math.PI;
  const toeMin = Math.PI * 0.08;
  const toeMax = Math.PI * 0.5 + fillAngle * 0.25;

  const revolutionSteps = 30;
  const particlesPerStep = 32;
  const trajectories = [];

  for (let step = 0; step < revolutionSteps; step += 1) {
    const phase = step / (revolutionSteps - 1);
    const phaseTime = phase * revolutionTime;
    const phaseAngle = omega * phaseTime;

    for (let i = 0; i < particlesPerStep; i += 1) {
      const r = radius * Math.sqrt(Math.random()) * 0.96;
      const theta = toeMin + Math.random() * (toeMax - toeMin) + phaseAngle;
      const x0 = r * Math.cos(theta);
      const y0 = r * Math.sin(theta);

      const liftTheta = theta + Math.min(1.85, omega * 0.9 + 0.35 + (radius - r) / radius * 0.65);
      const releaseX = r * Math.cos(liftTheta);
      const releaseY = r * Math.sin(liftTheta);

      const tangent = liftTheta + Math.PI / 2;
      const speed = omega * (r / radius) * radius * 0.065 + 2.2;
      const vx = speed * Math.cos(tangent);
      const vy = speed * Math.sin(tangent);

      const points = [];
      for (let t = 0; t < 1.3; t += 0.06) {
        const px = releaseX + vx * t;
        const py = releaseY + vy * t + 4.4 * t * t;
        const dist = Math.hypot(px, py);
        if (dist > radius * 0.98 && py > 0) break;
        points.push({ x: px, y: py, speed: Math.max(speed - t * 1.9, 0), phase });
      }

      trajectories.push({ seed: { x: x0, y: y0 }, points, phase });
    }
  }

  return { radius, trajectories };
}

function drawThrowPlot(model) {
  const { width, height } = throwCanvas;
  const center = { x: width / 2, y: height / 2 };

  throwCtx.clearRect(0, 0, width, height);
  drawMillShell(throwCtx, center, model.radius);

  throwCtx.save();
  throwCtx.translate(center.x, center.y);

  for (const trajectory of model.trajectories) {
    if (!trajectory.points.length) continue;

    const phaseAlpha = 0.08 + trajectory.phase * 0.2;
    throwCtx.strokeStyle = `rgba(154, 122, 174, ${phaseAlpha})`;
    throwCtx.lineWidth = 1;
    throwCtx.beginPath();
    throwCtx.moveTo(trajectory.seed.x, trajectory.seed.y);
    for (const point of trajectory.points) {
      throwCtx.lineTo(point.x, point.y);
    }
    throwCtx.stroke();

    for (const point of trajectory.points) {
      const c = mapColor(Math.min(point.speed / 11, 1));
      throwCtx.fillStyle = c;
      throwCtx.beginPath();
      throwCtx.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
      throwCtx.fill();
    }
  }

  throwCtx.restore();

  throwCtx.fillStyle = '#334155';
  throwCtx.font = '600 12px Inter, system-ui, Arial, sans-serif';
  throwCtx.fillText('Charge throw integrated over one full revolution (0°–360°)', 14, 20);
}

function drawVelocityMap(model) {
  const { width, height } = velocityCanvas;
  const center = { x: width / 2, y: height / 2 };

  velocityCtx.clearRect(0, 0, width, height);

  const resolution = 64;
  const cells = new Array(resolution * resolution).fill(0);
  const counts = new Array(resolution * resolution).fill(0);
  const radius = model.radius;
  const step = (radius * 2) / resolution;

  for (const trajectory of model.trajectories) {
    for (const point of trajectory.points) {
      const ix = Math.floor((point.x + radius) / step);
      const iy = Math.floor((point.y + radius) / step);
      if (ix < 0 || iy < 0 || ix >= resolution || iy >= resolution) continue;
      const index = iy * resolution + ix;
      cells[index] += point.speed;
      counts[index] += 1;
    }
  }

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
}

function readConfig() {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  for (const key of Object.keys(payload)) {
    payload[key] = Number(payload[key]);
  }
  return payload;
}

function renderVisualization() {
  const config = readConfig();
  const model = generateChargeModel(config);
  drawThrowPlot(model);
  drawVelocityMap(model);
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
    if (!response.ok) {
      output.textContent = JSON.stringify(data, null, 2);
      return;
    }

    output.textContent = JSON.stringify(data, null, 2);
    renderVisualization();
  } catch (error) {
    output.textContent = `Request failed: ${error}`;
  }
});

form.addEventListener('input', () => {
  renderVisualization();
});

renderVisualization();
