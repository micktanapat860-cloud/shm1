// ─── SHM Horizontal Spring Simulator ───────────────────────────────────────

const canvas = document.getElementById("sim");
const ctx    = canvas.getContext("2d");

const BLOCK_W = 50;
const BLOCK_H = 50;

// ─── Resize canvas ───────────────────────────────────────────────────────────
function resizeCanvas() {
  const maxW = Math.min(800, window.innerWidth - 32);
  canvas.width  = maxW;
  canvas.height = Math.round(maxW * 250 / 800);
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); restart(); });

// ─── Physics state ───────────────────────────────────────────────────────────
let mass, k, amplitude, beta;
let omega, omegaD, gamma;
let t = 0;
let animId   = null;
let lastTime = null;

// ─── Read inputs ─────────────────────────────────────────────────────────────
function readParams() {
  mass      = parseFloat(document.getElementById("mass").value)   || 5;
  k         = parseFloat(document.getElementById("spring").value) || 10;
  amplitude = parseFloat(document.getElementById("amp").value)    || 100;
  beta      = parseFloat(document.getElementById("custom").value) || 0;

  omega  = Math.sqrt(k / mass);
  gamma  = beta * omega;
  omegaD = Math.sqrt(Math.max(omega*omega - gamma*gamma, 0));
}

// ─── Position function ───────────────────────────────────────────────────────
function position(time) {
  return amplitude * Math.exp(-gamma * time) * Math.cos(omegaD * time);
}

// ─── Spring drawing ──────────────────────────────────────────────────────────
function drawSpring(x1, y, x2) {
  const coils  = 12;
  const height = 14;
  const len    = x2 - x1;
  const step   = len / (coils + 1);

  ctx.beginPath();
  ctx.moveTo(x1, y);
  for (let i = 0; i <= coils; i++) {
    const sx = x1 + step * (i + 0.5);
    const sy = y + (i % 2 === 0 ? -height : height);
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(x2, y);
  ctx.strokeStyle = "#555";
  ctx.lineWidth   = 2;
  ctx.stroke();
}

// ─── Draw wall ───────────────────────────────────────────────────────────────
function drawWall(CY, WALL_X) {
  ctx.fillStyle = "#444";
  ctx.fillRect(WALL_X - 12, CY - 80, 12, 160);

  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1.5;
  for (let y = CY - 80; y < CY + 80; y += 14) {
    ctx.beginPath();
    ctx.moveTo(WALL_X - 12, y);
    ctx.lineTo(WALL_X - 24, y + 10);
    ctx.stroke();
  }

  ctx.strokeStyle = "#888";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(WALL_X - 12, CY + BLOCK_H / 2 + 4);
  ctx.lineTo(canvas.width - 20, CY + BLOCK_H / 2 + 4);
  ctx.stroke();
}

// ─── Equilibrium marker ──────────────────────────────────────────────────────
function drawEquilibrium(CX, CY) {
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(CX, CY - 70);
  ctx.lineTo(CX, CY + 70);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.font      = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("eq.", CX, CY - 74);
}

// ─── Displacement arrow ──────────────────────────────────────────────────────
function drawDisplacementArrow(blockX, CX, CY) {
  const bx     = blockX + BLOCK_W / 2;
  const arrowY = CY - 82;
  ctx.lineWidth   = 1.5;
  ctx.strokeStyle = blockX >= CX ? "#c0392b" : "#2980b9";
  ctx.fillStyle   = blockX >= CX ? "#c0392b" : "#2980b9";

  ctx.beginPath();
  ctx.moveTo(CX, arrowY);
  ctx.lineTo(bx, arrowY);
  ctx.stroke();

  const dir = blockX >= CX ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(bx, arrowY);
  ctx.lineTo(bx - dir * 8, arrowY - 4);
  ctx.lineTo(bx - dir * 8, arrowY + 4);
  ctx.closePath();
  ctx.fill();

  const disp = (blockX + BLOCK_W / 2 - CX).toFixed(0);
  ctx.font      = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`x = ${disp} px`, (CX + bx) / 2, arrowY - 10);
}

// ─── Block drawing ───────────────────────────────────────────────────────────
function drawBlock(blockX, CY) {
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(blockX + 4, CY - BLOCK_H / 2 + 4, BLOCK_W, BLOCK_H);

  ctx.fillStyle   = "#2980b9";
  ctx.strokeStyle = "#1a5f8a";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.roundRect(blockX, CY - BLOCK_H / 2, BLOCK_W, BLOCK_H, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font      = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText("m", blockX + BLOCK_W / 2, CY + 6);

  const wheelY = CY + BLOCK_H / 2 + 4;
  for (const wx of [blockX + 10, blockX + BLOCK_W - 10]) {
    ctx.beginPath();
    ctx.arc(wx, wheelY, 5, 0, Math.PI * 2);
    ctx.fillStyle   = "#aaa";
    ctx.strokeStyle = "#666";
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();
  }
}

// ─── Info panel ──────────────────────────────────────────────────────────────
function drawInfo(x) {
  const vel = -amplitude * gamma * Math.exp(-gamma * t) * Math.cos(omegaD * t)
            -  amplitude * omegaD * Math.exp(-gamma * t) * Math.sin(omegaD * t);

  const lines = [
    `ω₀ = ${omega.toFixed(3)} rad/s`,
    `f₀ = ${(omega / (2 * Math.PI)).toFixed(3)} Hz`,
    `T  = ${(2 * Math.PI / (omegaD || omega)).toFixed(3)} s`,
    `γ  = ${gamma.toFixed(3)}`,
    `x  = ${x.toFixed(1)} px`,
    `v  = ${vel.toFixed(1)} px/s`,
    `t  = ${t.toFixed(2)} s`,
  ];

  ctx.fillStyle   = "rgba(255,255,255,0.85)";
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.roundRect(canvas.width - 170, 10, 155, lines.length * 18 + 14, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font      = "13px 'Courier New', monospace";
  ctx.fillStyle = "#222";
  ctx.textAlign = "left";
  lines.forEach((ln, i) => ctx.fillText(ln, canvas.width - 160, 28 + i * 18));
}

// ─── Main render ─────────────────────────────────────────────────────────────
function render(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  t += dt;

  // คำนวณใหม่ทุก frame ตาม canvas ปัจจุบัน
  const CX     = canvas.width  / 2;
  const CY     = canvas.height / 2;
  const WALL_X = 60;

  const x       = position(t);
  const blockX  = CX + x - BLOCK_W / 2;
  const springEnd = blockX;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawWall(CY, WALL_X);
  drawEquilibrium(CX, CY);
  drawSpring(WALL_X, CY, springEnd);
  drawDisplacementArrow(blockX, CX, CY);
  drawBlock(blockX, CY);
  drawInfo(x);

  animId = requestAnimationFrame(render);
}

// ─── Controls ────────────────────────────────────────────────────────────────
function restart() {
  if (animId) cancelAnimationFrame(animId);
  t        = 0;
  lastTime = null;
  readParams();
  animId = requestAnimationFrame(render);
}

["mass", "spring", "amp", "custom"].forEach(id => {
  document.getElementById(id).addEventListener("input", restart);
});

// ─── Start ───────────────────────────────────────────────────────────────────
readParams();
animId = requestAnimationFrame(render);

function openSettings() {
    document.getElementById('settings-overlay').classList.add('open');
}

function closeSettings(e) {
    if (!e || e.target === document.getElementById('settings-overlay') || !e.target) {
        document.getElementById('settings-overlay').classList.remove('open');
    }
}
