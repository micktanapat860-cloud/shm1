// ─── SHM Horizontal Dual Spring Simulator (With Real-time Graphs) ───

const canvas = document.getElementById("sim");
const ctx    = canvas.getContext("2d");

const BLOCK_W = 50;
const BLOCK_H = 50;

let graphHistory1 = [];
let graphHistory2 = [];
const MAX_GRAPH_POINTS = 140;

function resizeCanvas() {
  const maxW = Math.min(960, window.innerWidth - 32);
  canvas.width  = maxW;
  canvas.height = Math.round(maxW * 380 / 960);
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); restart(); });

// ใน State ไม่จำเป็นต้องคิดแรง G แล้ว
let sys1 = { mass: 4, k: 15, amp: 120, omega: 0, x: 0, v: 0, accel: 0 }; 
let sys2 = { mass: 6, k: 10, amp: 100, omega: 0, x: 0, v: 0, accel: 0 }; 

// ⏱️ แยกตัวแปรเวลาเป็น t1 และ t2 เพื่อให้ควบคุมอิสระแยกจากกันได้
let t1 = 0; 
let t2 = 0; 
let animId   = null;
let lastTime = null;

// ─── Read inputs (แก้ไขให้ยอมรับค่า 0 ได้ ไม่เด้งกลับเป็นค่าเริ่มต้น) ───
function readParams() {
  const inputAmp1 = parseFloat(document.getElementById("amp1").value);
  sys1.mass   = parseFloat(document.getElementById("mass1").value) || 4;
  sys1.k      = parseFloat(document.getElementById("spring1").value) || 15;
  sys1.amp    = isNaN(inputAmp1) ? 120 : inputAmp1;
  sys1.omega  = Math.sqrt(sys1.k / sys1.mass);

  const inputAmp2 = parseFloat(document.getElementById("amp2").value);
  sys2.mass   = parseFloat(document.getElementById("mass2").value) || 6;
  sys2.k      = parseFloat(document.getElementById("spring2").value) || 10;
  sys2.amp    = isNaN(inputAmp2) ? 100 : inputAmp2;
  sys2.omega  = Math.sqrt(sys2.k / sys2.mass);
}

function drawVectorArrow(fromX, toX, y, color, labelText) {
  if (Math.abs(toX - fromX) < 2) return;

  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 1.5;

  ctx.beginPath();
  ctx.moveTo(fromX, y);
  ctx.lineTo(toX, y);
  ctx.stroke();

  const arrowSize = 6;
  const dir = toX > fromX ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(toX, y);
  ctx.lineTo(toX - dir * arrowSize, y - arrowSize / 1.5);
  ctx.lineTo(toX - dir * arrowSize, y + arrowSize / 1.5);
  ctx.fill();

  ctx.font      = "11px Arial";
  ctx.textAlign = "center";
  ctx.fillText(labelText, (fromX + toX) / 2, y - 6);
}

function drawSystemGraph(graphLeft, graphTop, graphW, graphH, history, color, maxAmp) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(graphLeft, graphTop, graphW, graphH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(220, 220, 220, 0.6)"; 
  ctx.lineWidth = 1;
  
  for (let yOffset = 20; yOffset < graphH; yOffset += 20) {
    ctx.beginPath();
    ctx.moveTo(graphLeft, graphTop + yOffset);
    ctx.lineTo(graphLeft + graphW, graphTop + yOffset);
    ctx.stroke();
  }

  const numVerticalLines = 8;
  const vSpacing = graphW / numVerticalLines;
  for (let i = 1; i < numVerticalLines; i++) {
    ctx.beginPath();
    ctx.moveTo(graphLeft + (i * vSpacing), graphTop);
    ctx.lineTo(graphLeft + (i * vSpacing), graphTop + graphH);
    ctx.stroke();
  }

  const centerY = graphTop + graphH / 2;
  ctx.strokeStyle = "#aaa"; 
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]); 
  ctx.beginPath();
  ctx.moveTo(graphLeft, centerY);
  ctx.lineTo(graphLeft + graphW, centerY);
  ctx.stroke();
  ctx.setLineDash([]); 

  ctx.fillStyle = "#666";
  ctx.font = "9px Arial";
  ctx.textAlign = "left";
  ctx.fillText("+A", graphLeft + 5, graphTop + 12);
  ctx.fillText("-A", graphLeft + 5, graphTop + graphH - 4);
  ctx.textAlign = "right";
  ctx.fillText("x(t)", graphLeft + graphW - 5, centerY - 4);

  if (history.length > 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5; 
    ctx.beginPath();

    for (let i = 0; i < history.length; i++) {
      const ptX = graphLeft + graphW - ((history.length - 1 - i) * (graphW / MAX_GRAPH_POINTS));
      const scaleY = (history[i] / 150) * (graphH / 2); 
      const ptY = centerY - scaleY;

      if (i === 0) {
        ctx.moveTo(ptX, ptY);
      } else {
        ctx.lineTo(ptX, ptY);
      }
    }
    ctx.stroke();
  }
}

function drawSpring(x1, y, x2) {
  const coils  = 12;
  const height = 12;
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

function drawEnvironment(WALL_X) {
  ctx.fillStyle = "#444";
  ctx.fillRect(WALL_X - 12, 20, 12, canvas.height - 40);

  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1.5;
  for (let y = 20; y < canvas.height - 20; y += 14) {
    ctx.beginPath();
    ctx.moveTo(WALL_X - 12, y);
    ctx.lineTo(WALL_X - 24, y + 10);
    ctx.stroke();
  }

  ctx.strokeStyle = "#888";
  ctx.lineWidth   = 2;
  
  ctx.beginPath();
  ctx.moveTo(WALL_X - 12, 110 + BLOCK_H / 2 + 4);
  ctx.lineTo(canvas.width - 450, 110 + BLOCK_H / 2 + 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(WALL_X - 12, 250 + BLOCK_H / 2 + 4);
  ctx.lineTo(canvas.width - 450, 250 + BLOCK_H / 2 + 4);
  ctx.stroke();
}

function drawEquilibrium(CX, CY, label) {
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(CX, CY - 40);
  ctx.lineTo(CX, CY + 40);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.font      = "10px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`eq. ${label}`, CX, CY - 44);
}

function drawBlock(blockX, CY, color, label) {
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(blockX + 4, CY - BLOCK_H / 2 + 4, BLOCK_W, BLOCK_H);

  ctx.fillStyle   = color;
  ctx.strokeStyle = color === "#c0392b" ? "#962d22" : "#1a5f8a";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.roundRect(blockX, CY - BLOCK_H / 2, BLOCK_W, BLOCK_H, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font      = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(label, blockX + BLOCK_W / 2, CY + 5);

  const wheelY = CY + BLOCK_H / 2 + 4;
  for (const wx of [blockX + 10, blockX + BLOCK_W - 10]) {
    ctx.beginPath();
    ctx.arc(wx, wheelY, 4, 0, Math.PI * 2);
    ctx.fillStyle   = "#aaa";
    ctx.strokeStyle = "#666";
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();
  }
}

function drawInfo() {
  const boxW = 200;
  const boxH = canvas.height - 30;
  const startX = canvas.width - boxW - 15;
  const startY = 15;

  ctx.fillStyle   = "rgba(255,255,255,0.93)";
  ctx.strokeStyle = "#bbb";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.roundRect(startX, startY, boxW, boxH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.font      = "11px 'Courier New', monospace";
  ctx.textAlign = "left";
  
  // 🟥 RED SYSTEM DATA
  let currentY = startY + 20;
  ctx.fillStyle = "#c0392b";
  ctx.font      = "bold 12px Arial";
  ctx.fillText("🟥 RED SYSTEM", startX + 12, currentY);
  
  ctx.fillStyle = "#222";
  ctx.font      = "11px 'Courier New', monospace";
  ctx.fillText(`ω₀ = ${sys1.omega.toFixed(3)} rad/s`, startX + 12, currentY += 16);
  ctx.fillText(`f₀ = ${(sys1.omega / (2 * Math.PI)).toFixed(3)} Hz`, startX + 12, currentY += 14);
  ctx.fillText(`T  = ${(2 * Math.PI / sys1.omega).toFixed(3)} s`, startX + 12, currentY += 14);
  ctx.fillText(`x  = ${sys1.x.toFixed(1)} m`, startX + 12, currentY += 14);
  ctx.fillText(`v  = ${sys1.v.toFixed(1)} m/s`, startX + 12, currentY += 14);
  ctx.fillText(`a  = ${sys1.accel.toFixed(1)} m/s²`, startX + 12, currentY += 14); 
  ctx.fillText(`t  = ${t1.toFixed(2)} s`, startX + 12, currentY += 14); // ปรับแสดง t1

  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(startX + 10, currentY += 12);
  ctx.lineTo(startX + boxW - 10, currentY);
  ctx.stroke();

  // 🟦 BLUE SYSTEM DATA
  ctx.fillStyle = "#2980b9";
  ctx.font      = "bold 12px Arial";
  ctx.fillText("🟦 BLUE SYSTEM", startX + 12, currentY += 18);
  
  ctx.fillStyle = "#222";
  ctx.font      = "11px 'Courier New', monospace";
  ctx.fillText(`ω₀ = ${sys2.omega.toFixed(3)} rad/s`, startX + 12, currentY += 16);
  ctx.fillText(`f₀ = ${(sys2.omega / (2 * Math.PI)).toFixed(3)} Hz`, startX + 12, currentY += 14);
  ctx.fillText(`T  = ${(2 * Math.PI / sys2.omega).toFixed(3)} s`, startX + 12, currentY += 14);
  ctx.fillText(`x  = ${sys2.x.toFixed(1)} m`, startX + 12, currentY += 14);
  ctx.fillText(`v  = ${sys2.v.toFixed(1)} m/s`, startX + 12, currentY += 14);
  ctx.fillText(`a  = ${sys2.accel.toFixed(1)} m/s²`, startX + 12, currentY += 14); 
  ctx.fillText(`t  = ${t2.toFixed(2)} s`, startX + 12, currentY += 14); // ปรับแสดง t2
}

// ─── Main render ─────────────────────────────────────────────────────────────
function render(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  // ⏱️ เงื่อนไขสำคัญ: ถ้า Amplitude เป็น 0 เวลา t ในระบบจะถูกสั่งให้หยุดนับ (และเป็น 0) ทันที!
  if (sys1.amp !== 0) {
    t1 += dt;
  } else {
    t1 = 0; 
  }

  if (sys2.amp !== 0) {
    t2 += dt;
  } else {
    t2 = 0;
  }

  const CX     = (canvas.width - 450) / 2 + 55; 
  const WALL_X = 50;

  // 🟥 คำนวณระบบที่ 1 (แดง)
  if (sys1.amp === 0) {
    sys1.x = 0;
    sys1.v = 0;
    sys1.accel = 0;
  } else {
    sys1.x = sys1.amp * Math.cos(sys1.omega * t1); // เปลี่ยนมาใช้ t1
    sys1.v = -sys1.amp * sys1.omega * Math.sin(sys1.omega * t1);
    sys1.accel = -sys1.omega * sys1.omega * sys1.x;
  }
  const blockX1 = CX + sys1.x - BLOCK_W / 2;

  // 🟦 คำนวณระบบที่ 2 (น้ำเงิน)
  if (sys2.amp === 0) {
    sys2.x = 0;
    sys2.v = 0;
    sys2.accel = 0;
  } else {
    sys2.x = sys2.amp * Math.cos(sys2.omega * t2); // เปลี่ยนมาใช้ t2
    sys2.v = -sys2.amp * sys2.omega * Math.sin(sys2.omega * t2);
    sys2.accel = -sys2.omega * sys2.omega * sys2.x;
  }
  const blockX2 = CX + sys2.x - BLOCK_W / 2;

  // 📈 บันทึกตำแหน่งลงประวัติกราฟ (ถ้าแอมป์เป็น 0 ให้บันทึกเลข 0 ตลอดแนว)
  graphHistory1.push(sys1.x);
  if (graphHistory1.length > MAX_GRAPH_POINTS) graphHistory1.shift();

  graphHistory2.push(sys2.x);
  if (graphHistory2.length > MAX_GRAPH_POINTS) graphHistory2.shift();

  // เคลียร์หน้าจอแล้ววาดใหม่ทั้งหมด
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawEnvironment(WALL_X);

  // วาดระบบที่ 1 (แดง) 
  drawEquilibrium(CX, 110, "1");
  drawSpring(WALL_X, 110, blockX1);
  drawBlock(blockX1, 110, "#c0392b", "m₁");
  drawVectorArrow(CX, CX + sys1.x, 110 - BLOCK_H / 2 - 15, "#c0392b", `x = ${sys1.x.toFixed(1)} px`);

  // วาดระบบที่ 2 (น้ำเงิน)
  drawEquilibrium(CX, 250, "2");
  drawSpring(WALL_X, 250, blockX2);
  drawBlock(blockX2, 250, "#2980b9", "m₂");
  drawVectorArrow(CX, CX + sys2.x, 250 - BLOCK_H / 2 - 15, "#2980b9", `x = ${sys2.x.toFixed(1)} px`);

  // วาดกราฟและข้อมูลข้อมูล
  const graphW = 200;
  const graphH = 100;
  const graphLeft = canvas.width - 430; 

  drawSystemGraph(graphLeft, 45, graphW, graphH, graphHistory1, "#c0392b", sys1.amp);
  drawSystemGraph(graphLeft, 185, graphW, graphH, graphHistory2, "#2980b9", sys2.amp);

  drawInfo(); 

  animId = requestAnimationFrame(render);
}

function restart() {
  if (animId) cancelAnimationFrame(animId);
  t1       = 0; // ล้างค่าเวลา t1
  t2       = 0; // ล้างค่าเวลา t2
  lastTime = null;
  graphHistory1 = [];
  graphHistory2 = [];
  readParams();
  animId = requestAnimationFrame(render);
}

// อัปเดตกลับมาดักฟัง input แค่มวล ค่า k และแอมพลิจูด 
["mass1", "spring1", "amp1", "mass2", "spring2", "amp2"].forEach(id => {
  document.getElementById(id).addEventListener("input", restart);
});

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
