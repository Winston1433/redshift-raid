const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRID = 20;                 // 每格 20px
const COLS = canvas.width / GRID;
const ROWS = canvas.height / GRID;
const SPEED = 120;               // 每步毫秒數（越小越快）

const scoreEl = document.getElementById("score");
const highscoreEl = document.getElementById("highscore");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");

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
  const hitWall =
    head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
  const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) return gameOver();

  snake.unshift(head);

  // 吃到食物
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
  // 背景格線
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  for (let i = 0; i <= COLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * GRID, 0);
    ctx.lineTo(i * GRID, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * GRID);
    ctx.lineTo(canvas.width, i * GRID);
    ctx.stroke();
  }

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

function pause() {
  running = false;
  clearInterval(timer);
  overlayTitle.textContent = "暫停中 ⏸";
  overlayText.textContent = "按空白鍵繼續";
  overlay.classList.remove("hidden");
}

function resume() {
  running = true;
  overlay.classList.add("hidden");
  timer = setInterval(step, SPEED);
}

function gameOver() {
  running = false;
  clearInterval(timer);
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("snakeHighScore", highScore);
    highscoreEl.textContent = highScore;
  }
  overlayTitle.textContent = "遊戲結束 💀";
  overlayText.textContent = `你的分數：${score}　按空白鍵再玩一次`;
  overlay.classList.remove("hidden");
}

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (key === " ") {
    e.preventDefault();
    if (!running && (snake === undefined || timer === undefined || !snake)) start();
    else if (running) pause();
    else resume();
    return;
  }

  const dirs = {
    arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 },
  };

  const d = dirs[key];
  // 不能 180 度回頭
  if (d && !(d.x === -direction.x && d.y === -direction.y)) {
    nextDirection = d;
  }
});

// 初始畫面
init();
draw();
