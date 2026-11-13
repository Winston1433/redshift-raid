/* ================= 俄羅斯方塊 Tetris ================= */

const board = document.getElementById("board");
const ctx = board.getContext("2d");
const nextCv = document.getElementById("next");
const nctx = nextCv.getContext("2d");

const COLS = 10;
const ROWS = 20;
const CELL = 24; // board 240x480

const scoreEl = document.getElementById("score");
const highscoreEl = document.getElementById("highscore");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

/* 方塊形狀（每個是 4x4 / 3x3 矩陣，顏色索引） */
const SHAPES = [
  { m: [[1, 1, 1, 1]], c: "#00f0f0" },                 // I
  { m: [[1, 1], [1, 1]], c: "#f0f000" },               // O
  { m: [[0, 1, 0], [1, 1, 1]], c: "#a000f0" },         // T
  { m: [[0, 1, 1], [1, 1, 0]], c: "#00f000" },         // S
  { m: [[1, 1, 0], [0, 1, 1]], c: "#f00000" },         // Z
  { m: [[1, 0, 0], [1, 1, 1]], c: "#f0a000" },         // J
  { m: [[0, 0, 1], [1, 1, 1]], c: "#0000f0" },         // L
];

let grid, cur, nextPiece, score, highScore, level, lines, running, timer, dropInterval;

highScore = Number(localStorage.getItem("tetrisHighScore") || 0);
highscoreEl.textContent = highScore;

function emptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const s = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return {
    m: s.m.map((r) => [...r]),
    c: s.c,
    x: Math.floor((COLS - s.m[0].length) / 2),
    y: 0,
  };
}

function collide(p, nx, ny, mat) {
  const m = mat || p.m;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (!m[y][x]) continue;
      const gx = nx + x;
      const gy = ny + y;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
      if (gy >= 0 && grid[gy][gx]) return true;
    }
  }
  return false;
}

function rotate(m) {
  // 順時針旋轉矩陣
  const rows = m.length;
  const cols = m[0].length;
  const out = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      out[x][rows - 1 - y] = m[y][x];
  return out;
}

function tryRotate() {
  const rm = rotate(cur.m);
  if (!collide(cur, cur.x, cur.y, rm)) {
    cur.m = rm;
    return;
  }
  // 簡單的左右牆踢
  for (const dx of [-1, 1, -2, 2]) {
    if (!collide(cur, cur.x + dx, cur.y, rm)) {
      cur.x += dx;
      cur.m = rm;
      return;
    }
  }
}

function lock() {
  cur.m.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v && cur.y + y >= 0) grid[cur.y + y][cur.x + x] = cur.c;
    })
  );
  clearLines();
  spawn();
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (grid[y].every((c) => c)) {
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(null));
      cleared++;
      y++; // 同一行再檢查一次
    }
  }
  if (cleared > 0) {
    const pts = [0, 100, 300, 500, 800][cleared] * level;
    score += pts;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(120, 800 - (level - 1) * 70);
    scoreEl.textContent = score;
    levelEl.textContent = level;
    restartTimer();
  }
}

function spawn() {
  cur = nextPiece || randomPiece();
  nextPiece = randomPiece();
  drawNext();
  if (collide(cur, cur.x, cur.y)) return gameOver();
}

function move(dx) {
  if (!collide(cur, cur.x + dx, cur.y)) cur.x += dx;
  draw();
}

function softDrop() {
  if (!collide(cur, cur.x, cur.y + 1)) {
    cur.y++;
  } else {
    lock();
  }
  draw();
}

function hardDrop() {
  while (!collide(cur, cur.x, cur.y + 1)) cur.y++;
  lock();
  draw();
}

/* ---------- 畫面 ---------- */

function drawCell(c, x, y, size) {
  c.fillStyle = "rgba(255,255,255,0.08)";
  c.fillRect(x + 1, y + 1, size - 2, size - 2);
}

function draw() {
  ctx.clearRect(0, 0, board.width, board.height);

  // 格線
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  for (let i = 1; i < COLS; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, board.height); ctx.stroke();
  }
  for (let i = 1; i < ROWS; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(board.width, i * CELL); ctx.stroke();
  }

  // 已固定的方塊
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x]) {
        ctx.fillStyle = grid[y][x];
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      }
    }
  }

  // 目前下落中的方塊
  cur.m.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v && cur.y + y >= 0) {
        ctx.fillStyle = cur.c;
        ctx.fillRect((cur.x + x) * CELL + 1, (cur.y + y) * CELL + 1, CELL - 2, CELL - 2);
      }
    })
  );
}

function drawNext() {
  nctx.clearRect(0, 0, nextCv.width, nextCv.height);
  const m = nextPiece.m;
  const size = 20;
  const ox = (nextCv.width - m[0].length * size) / 2;
  const oy = (nextCv.height - m.length * size) / 2;
  m.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v) {
        nctx.fillStyle = nextPiece.c;
        nctx.fillRect(ox + x * size + 1, oy + y * size + 1, size - 2, size - 2);
      }
    })
  );
}

/* ---------- 遊戲流程 ---------- */

function start() {
  grid = emptyGrid();
  nextPiece = null;
  score = 0; level = 1; lines = 0;
  dropInterval = 800;
  scoreEl.textContent = 0;
  levelEl.textContent = 1;
  spawn();
  running = true;
  overlay.classList.add("hidden");
  restartTimer();
  draw();
}

function restartTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (running) softDrop();
  }, dropInterval);
}

function gameOver() {
  running = false;
  clearInterval(timer);
  const isNewRecord = score > highScore;
  if (isNewRecord) {
    highScore = score;
    localStorage.setItem("tetrisHighScore", highScore);
    highscoreEl.textContent = highScore;
  }
  overlayTitle.textContent = "遊戲結束 💀";
  overlayText.innerHTML = isNewRecord
    ? `🎉 新紀錄！你拿了 <b>${score} 分</b>（等級 ${level}）`
    : `你拿了 <b>${score} 分</b>（等級 ${level}）`;
  startBtn.textContent = "🔄 再玩一次";
  overlay.classList.remove("hidden");
}

/* ---------- 控制 ---------- */

document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
  if (e.key === " " && !running) { start(); return; }
  if (!running) return;
  if (k === "arrowleft") move(-1);
  else if (k === "arrowright") move(1);
  else if (k === "arrowdown") { softDrop(); }
  else if (k === "arrowup") { tryRotate(); draw(); }
  else if (e.key === " ") hardDrop();
});

document.querySelectorAll(".ctrl-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!running) return;
    const act = btn.dataset.act;
    if (act === "left") move(-1);
    else if (act === "right") move(1);
    else if (act === "down") softDrop();
    else if (act === "rotate") { tryRotate(); draw(); }
    else if (act === "drop") hardDrop();
  });
});

// 手機滑動：左右滑移動、上滑旋轉、下滑加速
let touchStart = null;
board.addEventListener("touchstart", (e) => {
  touchStart = e.touches[0];
}, { passive: true });
board.addEventListener("touchend", (e) => {
  if (!touchStart || !running) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.clientX;
  const dy = t.clientY - touchStart.clientY;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { tryRotate(); draw(); }
  else if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
  else if (dy > 40) hardDrop();
  touchStart = null;
}, { passive: true });

startBtn.addEventListener("click", start);

// 初始畫面
grid = emptyGrid();
cur = randomPiece();
draw();
