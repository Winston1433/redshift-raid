const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRID = 20;                 // 每格 20px
const COLS = canvas.width / GRID;
const ROWS = canvas.height / GRID;
const SPEED = 180;               // 毫秒，數字越大越慢越好上手

const scoreEl = document.getElementById("score");
const highscoreEl = document.getElementById("highscore");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

let snake, direction, nextDirection, food, score, highScore, running, timer;

highScore = Number(localStorage.getItem("snakeHighScore") || 0);
highscoreEl.textContent = highScore;

function init() {
  snake = [{ x: 10, y: 10 }];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  scoreEl.textContent = score;
  placeFood();
}

function placeFood() {
  do {
    food = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
}

function step() {
  direction = nextDirection;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  // 撞牆或撞自己 → 遊戲結束
  const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
  const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) return gameOver();

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    placeFood();
  } else {
    snake.pop();
  }

  draw();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 食物
  ctx.fillStyle = "#e74c3c";
  ctx.beginPath();
  ctx.arc(food.x * GRID + GRID / 2, food.y * GRID + GRID / 2, GRID / 2.6, 0, Math.PI * 2);
  ctx.fill();

  // 蛇身
  snake.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? "#2ecc71" : "#27ae60";
    ctx.fillRect(s.x * GRID + 1, s.y * GRID + 1, GRID - 2, GRID - 2);
  });
}

function start() {
  init();
  running = true;
  overlay.classList.add("hidden");
  clearInterval(timer);
  timer = setInterval(step, SPEED);
}

function gameOver() {
  running = false;
  clearInterval(timer);
  const isNewRecord = score > highScore;
  if (isNewRecord) {
    highScore = score;
    localStorage.setItem("snakeHighScore", highScore);
    highscoreEl.textContent = highScore;
  }
  overlayTitle.textContent = "遊戲結束 💀";
  overlayText.innerHTML = isNewRecord
    ? `🎉 新紀錄！你拿了 <b>${score} 分</b>`
    : `你拿了 <b>${score} 分</b>`;
  startBtn.textContent = "🔄 再玩一次";
  overlay.classList.remove("hidden");
}

/* ---------- 控制 ---------- */

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function setDirection(name) {
  const d = DIRS[name];
  if (!d) return;
  // 不能 180 度回頭
  if (d.x === -direction.x && d.y === -direction.y) return;
  nextDirection = d;
}

// 鍵盤
document.addEventListener("keydown", (e) => {
  const map = {
    arrowup: "up", w: "up",
    arrowdown: "down", s: "down",
    arrowleft: "left", a: "left",
    arrowright: "right", d: "right",
  };
  const dir = map[e.key.toLowerCase()];
  if (dir) e.preventDefault();
  if (dir && running) setDirection(dir);
  if (e.key === " " && !running) start();
});

// 螢幕方向按鈕
document.querySelectorAll(".dpad-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (running) setDirection(btn.dataset.dir);
  });
});

// 手機滑動
let touchStart = null;
canvas.addEventListener("touchstart", (e) => {
  touchStart = e.touches[0];
}, { passive: true });
canvas.addEventListener("touchend", (e) => {
  if (!touchStart || !running) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.clientX;
  const dy = t.clientY - touchStart.clientY;
  if (Math.abs(dx) > Math.abs(dy)) {
    setDirection(dx > 0 ? "right" : "left");
  } else {
    setDirection(dy > 0 ? "down" : "up");
  }
  touchStart = null;
}, { passive: true });

// 開始按鈕
startBtn.addEventListener("click", start);

// 初始畫面
init();
draw();
