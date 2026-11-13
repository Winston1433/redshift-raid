/* ================= TETRIS v2 ================= */

const board = document.getElementById("board");
const ctx = board.getContext("2d");
const nextCv = document.getElementById("next");
const nctx = nextCv.getContext("2d");

const COLS = 10;
const ROWS = 20;
const CELL = 30; // board 300x600

const scoreEl = document.getElementById("score");
const highscoreEl = document.getElementById("highscore");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

const SHAPES = [
  { m: [[1, 1, 1, 1]], c: "#22d3ee" },                 // I 青
  { m: [[1, 1], [1, 1]], c: "#facc15" },               // O 黃
  { m: [[0, 1, 0], [1, 1, 1]], c: "#c084fc" },         // T 紫
  { m: [[0, 1, 1], [1, 1, 0]], c: "#4ade80" },         // S 綠
  { m: [[1, 1, 0], [0, 1, 1]], c: "#f87171" },         // Z 紅
  { m: [[1, 0, 0], [1, 1, 1]], c: "#60a5fa" },         // J 藍
  { m: [[0, 0, 1], [1, 1, 1]], c: "#fb923c" },         // L 橘
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
  for (const dx of [-1, 1, -2, 2]) {
    if (!collide(cur, cur.x + dx, cur.y, rm)) {
      cur.x += dx;
      cur.m = rm;
      return;
    }
  }
}

function ghostY() {
  let y = cur.y;
  while (!collide(cur, cur.x, y + 1)) y++;
  return y;
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
      y++;
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

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawBlock(c, px, py, size, color, alpha) {
  c.globalAlpha = alpha === undefined ? 1 : alpha;
  c.fillStyle = color;
  roundRect(c, px + 1.5, py + 1.5, size - 3, size - 3, 5);
  c.fill();
  // 頂部高光
  c.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.25;
  c.fillStyle = "#ffffff";
  roundRect(c, px + 3, py + 3, size - 6, (size - 6) / 3, 4);
  c.fill();
  c.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, board.width, board.height);

  // 格線
  ctx.strokeStyle = "rgba(148,163,184,0.07)";
  ctx.lineWidth = 1;
  for (let i = 1; i < COLS; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, board.height); ctx.stroke();
  }
  for (let i = 1; i < ROWS; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(board.width, i * CELL); ctx.stroke();
  }

  if (!grid) return;

  // 幽靈方塊（落點預覽）
  if (running) {
    const gy = ghostY();
    if (gy !== cur.y) {
      cur.m.forEach((row, y) =>
        row.forEach((v, x) => {
          if (v && gy + y >= 0) {
            const px = (cur.x + x) * CELL;
            const py = (gy + y) * CELL;
            ctx.strokeStyle = cur.c;
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = 1.5;
            roundRect(ctx, px + 3, py + 3, CELL - 6, CELL - 6, 5);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        })
      );
    }
  }

  // 已固定的方塊
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x]) drawBlock(ctx, x * CELL, y * CELL, CELL, grid[y][x]);
    }
  }

  // 目前方塊
  if (cur) {
    cur.m.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v && cur.y + y >= 0) {
          drawBlock(ctx, (cur.x + x) * CELL, (cur.y + y) * CELL, CELL, cur.c);
        }
      })
    );
  }
}

function drawNext() {
  nctx.clearRect(0, 0, nextCv.width, nextCv.height);
  if (!nextPiece) return;
  const m = nextPiece.m;
  const size = 24;
  const ox = (nextCv.width - m[0].length * size) / 2;
  const oy = (nextCv.height - m.length * size) / 2;
  m.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v) drawBlock(nctx, ox + x * size, oy + y * size, size, nextPiece.c);
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
  overlayTitle.textContent = "GAME OVER";
  overlayText.innerHTML = isNewRecord
    ? `🎉 新紀錄！<b>${score}</b> 分 · 等級 ${level}`
    : `得到 <b>${score}</b> 分 · 等級 ${level}`;
  startBtn.textContent = "再玩一次";
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
  else if (k === "arrowdown") softDrop();
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
