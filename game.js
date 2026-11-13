'use strict';

const ui = Object.fromEntries(
  ['flight', 'briefing', 'headline', 'summary', 'launch', 'hud', 'health', 'points', 'pause', 'status', 'progress', 'pulse', 'charge', 'difficultyPicker', 'difficulty', 'difficultyHint']
    .map(id => [id, document.getElementById(id)])
);
const canvas = ui.flight;
const pen = canvas.getContext('2d', { alpha: false });
const pressed = new Set();
const flightKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyX']);
const stages = [
  { name: '赤砂峽谷', duration: 18, interval: 1.28, heavyEvery: 6, bossHp: 32, spread: [-.28, 0, .28], terrain: 0 },
  { name: '黃昏封鎖線', duration: 22, interval: .99, heavyEvery: 4, bossHp: 46, spread: [-.48, -.24, 0, .24, .48], terrain: 1 },
  { name: '黑曜母艦', duration: 25, interval: .8, heavyEvery: 3, bossHp: 62, spread: [-.66, -.44, -.22, 0, .22, .44, .66], terrain: 2 }
];
const difficulties = {
  easy: { health: 5, speed: .78, cadence: 1.26, bossArmor: .77, hint: '5 格耐久，敵方射擊較慢。' },
  normal: { health: 4, speed: 1, cadence: 1, bossArmor: 1, hint: '4 格耐久，標準彈速。' },
  hard: { health: 3, speed: 1.23, cadence: .78, bossArmor: 1.24, hint: '3 格耐久，彈幕更快，母艦裝甲更厚。' }
};
const landscapes = [
  { ground: '#b85d43', facets: ['#984630', '#a85139', '#bd6749', '#c87551', '#d58b60', '#b46245', '#a9543a'],
    cliffs: ['#683326', '#803b2b', '#a34c34', '#da9064'], ridge: '#aa5940' },
  { ground: '#a77a44', facets: ['#80532d', '#946634', '#b58044', '#c89151', '#d4a05b', '#ae7440', '#966336'],
    cliffs: ['#463127', '#654231', '#805330', '#bf9151'], ridge: '#946237' },
  { ground: '#55516b', facets: ['#423d57', '#50445c', '#61556e', '#6a5b73', '#7a6a83', '#595169', '#514660'],
    cliffs: ['#282334', '#393043', '#4b3d57', '#75637e'], ridge: '#55445e' }
];
const cliffSpacing = 96;
const playerColor = '#e9f6c5';
let w;
let h;
let density;
let mode = 'ready';
let clock = 0;
let pointer = null;
let previous = performance.now();
let run;

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const noise = n => {
  const a = Math.sin(n * 73.17 + 11.7) * 43758.54;
  return a - Math.floor(a);
};

function resize() {
  const bounds = canvas.getBoundingClientRect();
  if (run && w && h) {
    for (const object of [run.player, ...run.enemies, ...run.bullets, ...run.bolts, ...run.particles]) {
      object.x *= bounds.width / w;
      object.y *= bounds.height / h;
      if (object.home !== undefined) object.home *= bounds.width / w;
    }
  }
  w = bounds.width;
  h = bounds.height;
  density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * density);
  canvas.height = Math.round(h * density);
  pointer = null;
}

function show(next) {
  mode = next;
  pressed.clear();
  pointer = null;
  const playing = next === 'flight';
  ui.hud.hidden = !playing;
  ui.briefing.hidden = playing;
  ui.difficultyPicker.hidden = next === 'paused' || next === 'cleared';
  if (playing) {
    canvas.focus({ preventScroll: true });
    return;
  }
  const screens = {
    paused: ['任務暫停', '戰機已進入待命。', '繼續出擊'],
    cleared: () => ['關卡完成', `下一關 · ${stages[run.stageIndex + 1].name}。耐久恢復一格，脈衝充滿。`, '下一關'],
    lost: ['機體失聯', `本次得分 ${run.score.toLocaleString('zh-TW')}`, '再飛一次'],
    won: ['全關通過', `黑曜母艦已摧毀，最終得分 ${run.score.toLocaleString('zh-TW')}`, '再飛一次']
  };
  const [heading, summary, label] = next === 'cleared' ? screens.cleared() : screens[next];
  ui.headline.textContent = heading;
  ui.summary.textContent = summary;
  ui.launch.firstChild.textContent = label + ' ';
  ui.launch.focus({ preventScroll: true });
}

function start() {
  const difficulty = difficulties[ui.difficulty.value];
  run = { stageIndex: 0, difficulty, score: 0, health: difficulty.health };
  beginStage();
}

function beginStage() {
  const stage = stages[run.stageIndex];
  Object.assign(run, {
    stage, elapsed: 0, nextEnemy: 1, spawned: 0, energy: 100, blast: 0, boss: null,
    player: { x: w * .5, y: h * .78, wait: 0, grace: 0, tilt: 0 },
    enemies: [], bullets: [], bolts: [], particles: []
  });
  updateHud();
  show('flight');
}

function advanceStage() {
  run.stageIndex++;
  run.health = Math.min(run.difficulty.health, run.health + 1);
  beginStage();
}

function updateHud() {
  const progress = run.boss ? run.boss.hp / run.boss.max : run.elapsed / run.stage.duration;
  const status = run.boss ? '母艦耐久' : run.stage.name;
  ui.status.textContent = `${run.stageIndex + 1} / ${stages.length} · ${status}`;
  ui.progress.style.width = `${clamp(progress, 0, 1) * 100}%`;
  ui.health.setAttribute('aria-valuemax', run.difficulty.health);
  ui.health.setAttribute('aria-valuenow', run.health);
  for (const [index, bar] of Array.from(ui.health.children).entries()) {
    bar.hidden = index >= run.difficulty.health;
    bar.classList.toggle('empty', index >= run.health);
  }
  ui.points.textContent = String(run.score).padStart(5, '0');
  ui.charge.textContent = `${Math.floor(run.energy)}%`;
  ui.pulse.disabled = run.energy < 100;
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 185;
    run.particles.push({ x, y, dx: Math.cos(a) * speed, dy: Math.sin(a) * speed, life: .32 + Math.random() * .38, color });
  }
}

function damage(target, amount) {
  if (target.hp <= 0) return;
  target.hp = Math.max(0, target.hp - amount);
  if (target.hp > 0) return;
  run.score += target.boss ? 2500 : target.heavy ? 240 : 110;
  run.energy = Math.min(100, run.energy + (target.heavy ? 11 : 6));
  burst(target.x, target.y, '#fff0a5', target.boss ? 75 : 17);
  if (target.boss) show(run.stageIndex === stages.length - 1 ? 'won' : 'cleared');
}

function pulse() {
  if (mode !== 'flight' || run.energy < 100) return;
  run.energy = 0;
  run.blast = .53;
  for (const bolt of run.bolts) burst(bolt.x, bolt.y, '#f9d38a', 3);
  run.bolts = [];
  for (const enemy of run.enemies) damage(enemy, enemy.boss ? 9 : 2);
  updateHud();
}

function hit() {
  if (run.player.grace > 0 || mode !== 'flight') return;
  run.health--;
  run.player.grace = 1.2;
  burst(run.player.x, run.player.y, '#fff7d0', 22);
  if (run.health === 0) show('lost');
}

function spawn(boss) {
  const index = run.spawned++;
  const heavy = !boss && (index + 1) % run.stage.heavyEvery === 0;
  const home = boss ? w * .5 : w * (.17 + noise(index + 38) * .66);
  const hp = boss ? Math.round(run.stage.bossHp * run.difficulty.bossArmor) : heavy ? 5 : 2;
  const enemy = {
    x: home, y: boss ? -74 : -32, home, age: 0, boss, heavy,
    hp, max: hp, r: boss ? 52 : heavy ? 24 : 15,
    wait: boss ? 2 : 1 + noise(index + 46)
  };
  run.enemies.push(enemy);
  if (boss) run.boss = enemy;
}

function movePlayer(dt) {
  const p = run.player;
  const horizontal = Number(pressed.has('ArrowRight') || pressed.has('KeyD')) - Number(pressed.has('ArrowLeft') || pressed.has('KeyA'));
  const vertical = Number(pressed.has('ArrowDown') || pressed.has('KeyS')) - Number(pressed.has('ArrowUp') || pressed.has('KeyW'));
  const speed = clamp(w * .51, 255, 510);
  const px = p.x;
  if (pointer) {
    p.x += clamp(pointer.x - p.x, -speed * 2 * dt, speed * 2 * dt);
    p.y += clamp(pointer.y - p.y, -speed * 2 * dt, speed * 2 * dt);
  } else {
    const diagonal = horizontal && vertical ? Math.SQRT1_2 : 1;
    p.x += horizontal * speed * dt * diagonal;
    p.y += vertical * speed * dt * diagonal;
  }
  p.x = clamp(p.x, 23, w - 23);
  p.y = clamp(p.y, Math.max(75, h * .24), Math.max(76, h - 68));
  p.tilt += (clamp((p.x - px) * .065, -.35, .35) - p.tilt) * Math.min(1, dt * 12);
  p.grace = Math.max(0, p.grace - dt);
  p.wait -= dt;
  if (p.wait <= 0 && (pressed.has('Space') || pointer)) {
    run.bullets.push({ x: p.x - 10, y: p.y - 13, r: 4 }, { x: p.x + 10, y: p.y - 13, r: 4 });
    p.wait = .155;
  }
}

function aim(enemy) {
  const angle = Math.atan2(run.player.y - enemy.y, run.player.x - enemy.x);
  const spread = enemy.boss ? run.stage.spread : enemy.heavy ? [-.23, 0, .23] : [0];
  for (const offset of spread) {
    const direction = angle + offset;
    const speed = (enemy.boss ? 245 : 195) * run.difficulty.speed;
    run.bolts.push({ x: enemy.x, y: enemy.y + 10, dx: Math.cos(direction) * speed, dy: Math.sin(direction) * speed, r: enemy.boss ? 7 : 5 });
  }
}

function overlap(a, b, radius = b.r) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.r + radius) ** 2;
}

function update(dt) {
  run.elapsed += dt;
  run.energy = Math.min(100, run.energy + dt * 2.5);
  run.blast = Math.max(0, run.blast - dt);
  movePlayer(dt);
  if (!run.boss && run.elapsed >= run.stage.duration) {
    spawn(true);
  } else if (!run.boss && run.elapsed >= run.nextEnemy) {
    spawn(false);
    run.nextEnemy = run.elapsed + run.stage.interval * run.difficulty.cadence;
  }
  for (const enemy of run.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.age += dt;
    if (enemy.boss) {
      enemy.y = Math.min(enemy.y + dt * 100, h * .23);
      enemy.x = w * (.5 + Math.sin(enemy.age * .95) * .29);
    } else {
      enemy.y += dt * (enemy.heavy ? 100 : 133) * run.difficulty.speed;
      enemy.x = clamp(enemy.home + Math.sin(enemy.age * 2.2) * 48, 22, w - 22);
      if (overlap(enemy, run.player, 15)) {
        enemy.hp = 0;
        burst(enemy.x, enemy.y, '#ffe5aa', 12);
        hit();
        if (mode !== 'flight') return;
        continue;
      }
    }
    enemy.wait -= dt;
    if (enemy.wait <= 0 && enemy.y > 24 && (enemy.boss || enemy.y < run.player.y - 50)) {
      aim(enemy);
      enemy.wait = (enemy.boss ? (enemy.hp < enemy.max / 2 ? .72 : 1.04) : 2.1) * run.difficulty.cadence;
    }
  }
  for (const bullet of run.bullets) {
    bullet.y -= dt * 735;
    const target = run.enemies.find(enemy => enemy.hp > 0 && overlap(bullet, enemy));
    if (!target) continue;
    bullet.dead = true;
    damage(target, 1);
    if (mode !== 'flight') return;
  }
  for (const bolt of run.bolts) {
    bolt.x += bolt.dx * dt;
    bolt.y += bolt.dy * dt;
    if (overlap(bolt, run.player, 14)) {
      bolt.dead = true;
      hit();
      if (mode !== 'flight') return;
    }
  }
  run.enemies = run.enemies.filter(e => e.hp > 0 && e.y < h + 65);
  run.bullets = run.bullets.filter(b => !b.dead && b.y > -16);
  run.bolts = run.bolts.filter(b => !b.dead && b.x > -30 && b.x < w + 30 && b.y > -30 && b.y < h + 30);
  updateHud();
}

function shape(color, points, outline) {
  pen.beginPath();
  pen.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) pen.lineTo(...points[i]);
  pen.closePath();
  pen.fillStyle = color;
  pen.fill();
  if (outline) {
    pen.strokeStyle = outline;
    pen.lineWidth = 1.4;
    pen.stroke();
  }
}

function terrain() {
  const drift = clock * 125;
  const row = Math.floor(drift / cliffSpacing);
  const offset = drift % cliffSpacing;
  const { ground, facets, cliffs, ridge } = landscapes[run?.stage.terrain ?? 0];
  pen.fillStyle = ground;
  pen.fillRect(0, 0, w, h);
  const step = Math.max(85, w / 11);
  const rows = Math.ceil(h / cliffSpacing) + 2;
  for (let i = -1; i < rows; i++) {
    const y = i * cliffSpacing + offset;
    const seed = i - row;
    for (let col = 0; col <= Math.ceil(w / step); col++) {
      const x = col * step;
      const k = seed * 31 + col;
      const corner = (noise(k + 40) - .5) * step;
      shape(facets[Math.floor(noise(k + 133) * facets.length)], [[x, y], [x + step + 1, y], [x + corner + step * .44, y + cliffSpacing + 1], [x, y + cliffSpacing + 1]]);
      shape(facets[Math.floor(noise(k + 317) * facets.length)], [[x + step, y], [x + step + 1, y + cliffSpacing + 1], [x + corner + step * .44 - 1, y + cliffSpacing + 1]]);
    }
    for (const side of [-1, 1]) {
      const shore = (seed, layer) => {
        const edge = w * (.135 + layer * .047) + noise(seed * 7 + side * 50 + layer) * w * .075;
        return side === -1 ? edge : w - edge;
      };
      const edge = side === -1 ? -2 : w + 2;
      for (let layer = 3; layer >= 0; layer--) {
        const top = shore(seed, layer);
        const bottom = shore(seed + 1, layer);
        shape(cliffs[layer], [[edge, y], [top, y], [bottom, y + cliffSpacing + 1], [edge, y + cliffSpacing + 1]]);
        if (layer === 1) {
          shape(ridge, [[edge, y], [top, y], [bottom, y + cliffSpacing * .81]]);
        }
      }
    }
  }
  for (let i = 0; i < 100; i++) {
    const x = noise(i * 9 + 210) * w;
    const y = (noise(i * 8 + 70) * h + drift * (.65 + noise(i + 22) * .3)) % h;
    pen.fillStyle = i % 3 === 0 ? '#ffdfaa58' : '#622e2642';
    pen.fillRect(x, y, 1 + noise(i + 12) * 4, 1 + noise(i) * 2);
  }
}

function fighter(x, y, size, tilt, enemy) {
  pen.save();
  pen.translate(x, y);
  pen.rotate(tilt);
  pen.scale(size, size);
  const outline = '#302d20';
  if (!enemy) {
    const hull = [[0, -38], [9, -22], [12, -4], [42, 19], [42, 27], [13, 19], [8, 32], [-8, 32], [-13, 19], [-42, 27], [-42, 19], [-12, -4], [-9, -22]];
    pen.save();
    pen.translate(11, 15);
    shape('#35221f62', hull);
    pen.restore();
    shape('#ffe6a1', [[-7, 29], [0, 46 + Math.sin(clock * 37) * 6], [7, 29]]);
    shape(playerColor, hull, outline);
    shape('#93aa77', [[0, -37], [9, -22], [12, -4], [42, 19], [42, 27], [13, 19], [8, 32], [0, 32]]);
    shape('#254e43', [[0, -23], [6, -13], [6, 2], [0, 9], [-6, 2], [-6, -13]], outline);
    shape('#fff8d6', [[0, -20], [2, -12], [2, -3], [0, -1]]);
    for (const side of [-1, 1]) {
      shape('#b5452e', [[side * 31, 11], [side * 37, 15], [side * 37, 24], [side * 31, 22]]);
    }
  } else {
    shape('#342f26', [[-36, -17], [-17, -10], [-10, -27], [10, -27], [17, -10], [36, -17], [31, 11], [15, 18], [0, 29], [-15, 18], [-31, 11]], '#fff0b6');
    shape('#bd522f', [[-28, -11], [-12, -4], [-6, -20], [6, -20], [12, -4], [28, -11], [23, 8], [0, 19], [-23, 8]]);
    shape('#ffcf81', [[0, -8], [7, 1], [0, 12], [-7, 1]]);
  }
  pen.restore();
}

function draw() {
  if (w < 1 || h < 1) return;
  pen.setTransform(density, 0, 0, density, 0, 0);
  terrain();
  if (mode === 'ready') {
    const mobile = matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
    const size = clamp(Math.min(w, h) / (mobile ? 182 : 200), 1, 4.2);
    fighter(w * (mobile ? .54 : .69), h * (mobile ? .22 : .53), size, -.47 + Math.sin(clock * 1.7) * .07, false);
    fighter(w * (mobile ? .21 : .52), h * .12, size * .44, .26, true);
    fighter(w * (mobile ? .82 : .89), h * (mobile ? .11 : .23), size * .56, .22, true);
    return;
  }
  for (const e of run.enemies) {
    if (e.hp <= 0) continue;
    fighter(e.x, e.y, e.boss ? 1.85 : e.heavy ? .76 : .51, Math.sin(e.age * 3) * .16, true);
  }
  pen.fillStyle = '#f8ffbe';
  for (const b of run.bullets) pen.fillRect(b.x - 2, b.y - 12, 4, 15);
  for (const b of run.bolts) {
    pen.beginPath();
    pen.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    pen.fillStyle = '#fff0b4';
    pen.fill();
    pen.strokeStyle = '#652333';
    pen.lineWidth = 3;
    pen.stroke();
  }
  for (const p of run.particles) {
    pen.globalAlpha = Math.min(1, p.life * 2.6);
    pen.fillStyle = p.color;
    pen.fillRect(p.x, p.y, 4, 4);
  }
  pen.globalAlpha = 1;
  if (mode !== 'lost' && Math.floor(run.player.grace * 18) % 2 === 0) {
    fighter(run.player.x, run.player.y, .65, run.player.tilt, false);
  }
  if (run.blast > 0) {
    pen.beginPath();
    pen.arc(run.player.x, run.player.y, 12 + (1 - run.blast / .53) * Math.hypot(w, h), 0, Math.PI * 2);
    pen.strokeStyle = `rgba(255, 246, 167, ${run.blast / .53})`;
    pen.lineWidth = 15;
    pen.stroke();
  }
}

function frame(now) {
  const dt = clamp((now - previous) / 1000, 0, .034);
  previous = now;
  if (mode === 'flight') update(dt);
  if (mode !== 'paused') {
    clock += dt;
    if (run) {
      for (const p of run.particles) {
        p.x += p.dx * dt;
        p.y += p.dy * dt;
        p.life -= dt;
      }
      run.particles = run.particles.filter(p => p.life > 0);
    }
  }
  draw();
  requestAnimationFrame(frame);
}

function pause() {
  if (mode === 'flight') show('paused');
  else if (mode === 'paused') show('flight');
}

function movePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top - (event.pointerType === 'touch' ? 38 : 0);
}

ui.difficulty.addEventListener('change', () => {
  ui.difficultyHint.textContent = difficulties[ui.difficulty.value].hint;
});
ui.launch.addEventListener('click', () => {
  if (mode === 'paused') pause();
  else if (mode === 'cleared') advanceStage();
  else start();
});
ui.pause.addEventListener('click', pause);
ui.pulse.addEventListener('click', () => {
  pulse();
  if (mode === 'flight') canvas.focus({ preventScroll: true });
});
window.addEventListener('keydown', event => {
  if (['KeyP', 'Escape'].includes(event.code) && !event.repeat) pause();
  if (mode !== 'flight' || !flightKeys.has(event.code)) return;
  if (event.code === 'Space' && event.target instanceof HTMLButtonElement) return;
  event.preventDefault();
  pressed.add(event.code);
  if (event.code === 'KeyX' && !event.repeat) pulse();
});
window.addEventListener('keyup', event => pressed.delete(event.code));
window.addEventListener('blur', () => { if (mode === 'flight') show('paused'); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'flight') show('paused');
});
canvas.addEventListener('pointerdown', event => {
  if (mode !== 'flight' || pointer || event.button !== 0) return;
  pointer = { id: event.pointerId };
  movePointer(event);
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (pointer?.id === event.pointerId) movePointer(event);
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(event, e => { if (pointer?.id === e.pointerId) pointer = null; });
}
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
