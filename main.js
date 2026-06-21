// ─── SHM Horizontal Spring Simulator ───────────────────────────────────────
 
const canvas = document.getElementById("sim");
const ctx    = canvas.getContext("2d");
 
// ─── Physics state ───────────────────────────────────────────────────────────
let mass, k, amplitude, beta;   // parameters from inputs
let omega, omegaD, gamma;       // derived physics
let t = 0;
let animId = null;
let lastTime = null;
 
// ─── Layout constants ────────────────────────────────────────────────────────
const CX      = canvas.width  / 2;   // horizontal centre of canvas
const CY      = canvas.height / 2;   // vertical   centre of canvas
const WALL_X  = 60;                  // x of fixed wall
const BLOCK_W = 50;
const BLOCK_H = 50;
 
// ─── Read inputs ─────────────────────────────────────────────────────────────
function readParams() {
  mass      = parseFloat(document.getElementById("mass").value)   || 5;
  k         = parseFloat(document.getElementById("spring").value) || 10;
  amplitude = parseFloat(document.getElementById("amp").value)    || 100;
  beta      = parseFloat(document.getElementById("custom").value) || 0; // damping ratio β
 
  omega  = Math.sqrt(k / mass);                    // natural angular frequency
  gamma  = beta * omega;                           // damping coefficient γ
  omegaD = Math.sqrt(Math.max(omega*omega - gamma*gamma, 0)); // damped frequency
}
 
// ─── Position function ───────────────────────────────────────────────────────
// x(t) = A · e^{-γt} · cos(ωD · t)
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
 
// ─── Draw floor / wall ───────────────────────────────────────────────────────
function drawWall() {
  // vertical wall
  ctx.fillStyle = "#444";
  ctx.fillRect(WALL_X - 12, CY - 80, 12, 160);
 
  // hatch marks
  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1.5;
  for (let y = CY - 80; y < CY + 80; y += 14) {
    ctx.beginPath();
    ctx.moveTo(WALL_X - 12, y);
    ctx.lineTo(WALL_X - 24, y + 10);
    ctx.stroke();
  }
 
  // floor line
  ctx.strokeStyle = "#888";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(WALL_X - 12, CY + BLOCK_H / 2 + 4);
  ctx.lineTo(canvas.width - 20, CY + BLOCK_H / 2 + 4);
  ctx.stroke();
}
 
// ─── Equilibrium marker ──────────────────────────────────────────────────────
function drawEquilibrium() {
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
 
// ─── Displacement indicator ──────────────────────────────────────────────────
function drawDisplacementArrow(blockX) {
  const bx    = blockX + BLOCK_W / 2;
  const arrowY = CY - 82;
  ctx.lineWidth   = 1.5;
  ctx.strokeStyle = blockX >= CX ? "#c0392b" : "#2980b9";
  ctx.fillStyle   = blockX >= CX ? "#c0392b" : "#2980b9";
 
  ctx.beginPath();
  ctx.moveTo(CX, arrowY);
  ctx.lineTo(bx, arrowY);
  ctx.stroke();
 
  // arrowhead
  const dir = blockX >= CX ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(bx, arrowY);
  ctx.lineTo(bx - dir * 8, arrowY - 4);
  ctx.lineTo(bx - dir * 8, arrowY + 4);
  ctx.closePath();
  ctx.fill();
 
  // label
  const disp = (blockX + BLOCK_W / 2 - CX).toFixed(0);
  ctx.font      = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`x = ${disp} px`, (CX + bx) / 2, arrowY - 10);
}
 
// ─── Block drawing ───────────────────────────────────────────────────────────
function drawBlock(blockX) {
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(blockX + 4, CY - BLOCK_H / 2 + 4, BLOCK_W, BLOCK_H);
 
  // body
  ctx.fillStyle   = "#2980b9";
  ctx.strokeStyle = "#1a5f8a";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.roundRect(blockX, CY - BLOCK_H / 2, BLOCK_W, BLOCK_H, 6);
  ctx.fill();
  ctx.stroke();
 
  // 'm' label
  ctx.fillStyle = "#fff";
  ctx.font      = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText("m", blockX + BLOCK_W / 2, CY + 6);
 
  // little wheels
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
 
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1;
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
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap dt
  lastTime = timestamp;
  t += dt;
 
  const x    = position(t);                       // displacement from equilibrium
  const blockX = CX + x - BLOCK_W / 2;            // left edge of block
  const springEnd = blockX;                        // spring right end = block left
 
  ctx.clearRect(0, 0, canvas.width, canvas.height);
 
  drawWall();
  drawEquilibrium();
  drawSpring(WALL_X, CY, springEnd);
  drawDisplacementArrow(blockX);
  drawBlock(blockX);
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
 
// Re-read parameters on every input change and restart simulation
["mass", "spring", "amp", "custom"].forEach(id => {
  document.getElementById(id).addEventListener("input", restart);
});
 
// ─── Start ───────────────────────────────────────────────────────────────────
readParams();
animId = requestAnimationFrame(render);
 
const modalData = {
    mass: {
        title: 'Mass มวล (m)',
        formula: 'F = ma',
        desc: 'มวลของวัตถุที่ติดกับสปริง มีผลต่อคาบการสั่น T = 2π√(m/k) — มวลมากขึ้น คาบยาวขึ้น'
    },
    spring: {
        title: 'Spring Constant (k)',
        formula: 'F = −kx',
        desc: 'ค่าคงที่สปริง บอกความแข็งของสปริง k มากขึ้น สปริงแข็งขึ้น คาบสั้นลง'
    },
    amp: {
        title: 'Amplitude แอมพลิจูด (A)',
        formula: 'x(t) = A cos(ωt)',
        desc: 'ระยะการกระจัดสูงสุดจากจุดสมดุล ไม่มีผลต่อคาบ แต่มีผลต่อความเร็วและพลังงาน'
    },
    custom: {
        title: 'Damping β',
        formula: 'x(t) = Ae^(−βt) cos(ωt)',
        desc: 'สัมประสิทธิ์การหน่วง ถ้า β = 0 คือ SHM อุดมคติ β มากขึ้น การสั่นจะลดลงเร็วขึ้น'
    }
};

function openModal(key) {
    const d = modalData[key];
    document.getElementById('modal-title').textContent = d.title;
    document.getElementById('modal-formula').textContent = d.formula;
    document.getElementById('modal-desc').textContent = d.desc;
    document.getElementById('modal-overlay').classList.add('open');
}

function closeModal(e) {
    if (!e || e.target === document.getElementById('modal-overlay') || !e.target) {
        document.getElementById('modal-overlay').classList.remove('open');
    }
}