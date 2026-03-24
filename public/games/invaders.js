(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const waveEl = document.getElementById("wave");
  const resultEl = document.getElementById("result-text");

  const W = canvas.width;
  const H = canvas.height;

  const PINK = "#ff2a6d";
  const CYAN = "#00e5ff";
  const GREEN = "#00ffaa";
  const PURPLE = "#b44aff";
  const BG = "#020010";

  // Pixel art patterns (8x8 grids, 1=filled)
  const INVADER_A = [
    [0,0,1,0,0,0,1,0],
    [0,0,0,1,0,1,0,0],
    [0,0,1,1,1,1,1,0],
    [0,1,1,0,1,0,1,1],
    [1,1,1,1,1,1,1,1],
    [1,0,1,1,1,1,0,1],
    [1,0,1,0,0,1,0,1],
    [0,0,0,1,1,0,0,0],
  ];
  const INVADER_B = [
    [0,0,0,1,1,0,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [1,1,0,1,1,0,1,1],
    [1,1,1,1,1,1,1,1],
    [0,0,1,0,0,1,0,0],
    [0,1,0,1,1,0,1,0],
    [1,0,1,0,0,1,0,1],
  ];

  const SHIP_PATTERN = [
    [0,0,0,1,0,0,0],
    [0,0,1,1,1,0,0],
    [0,0,1,1,1,0,0],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
  ];

  const PIXEL = 3;
  const INVADER_W = 8 * PIXEL;
  const INVADER_H = 8 * PIXEL;
  const SHIP_W = 7 * PIXEL;
  const SHIP_H = 5 * PIXEL;

  // Stars
  const stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.3 + 0.1,
      brightness: Math.random(),
    });
  }

  // State
  let state = "START";
  let score = 0;
  let lives = 3;
  let wave = 1;
  let shipX = W / 2 - SHIP_W / 2;
  let invaders = [];
  let bullets = [];
  let enemyBullets = [];
  let particles = [];
  let invaderDir = 1;
  let invaderSpeed = 0.5;
  let invaderDropTimer = 0;
  let shouldDrop = false;
  let shootCooldown = 0;
  let enemyShootTimer = 0;
  let frameCount = 0;

  const keys = {};

  // Audio
  let audioCtx;
  function beep(freq, dur, type) {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.stop(audioCtx.currentTime + dur);
  }

  function drawPixelArt(pattern, x, y, color, px) {
    ctx.fillStyle = color;
    for (let r = 0; r < pattern.length; r++) {
      for (let c = 0; c < pattern[r].length; c++) {
        if (pattern[r][c]) {
          ctx.fillRect(x + c * px, y + r * px, px, px);
        }
      }
    }
  }

  function initWave() {
    invaders = [];
    const cols = 8;
    const rows = 4 + Math.min(wave - 1, 2);
    const offsetX = (W - cols * (INVADER_W + 10)) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        invaders.push({
          x: offsetX + c * (INVADER_W + 10),
          y: 30 + r * (INVADER_H + 8),
          alive: true,
          pattern: r % 2 === 0 ? INVADER_A : INVADER_B,
          color: r === 0 ? PINK : r === 1 ? PURPLE : r === 2 ? CYAN : GREEN,
          points: (rows - r) * 10,
        });
      }
    }
    invaderDir = 1;
    invaderSpeed = 0.5 + wave * 0.15;
    enemyBullets = [];
  }

  function startGame() {
    score = 0;
    lives = 3;
    wave = 1;
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    waveEl.textContent = wave;
    shipX = W / 2 - SHIP_W / 2;
    bullets = [];
    particles = [];
    initWave();
    state = "PLAYING";
    overlay.classList.add("hidden");
    resultEl.textContent = "";
  }

  function showOverlay(text) {
    resultEl.textContent = text;
    overlay.classList.remove("hidden");
  }

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particles.push({
        x, y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 15 + Math.random() * 15,
        color,
        size: 1 + Math.random() * 2,
      });
    }
  }

  // Input
  document.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "KeyP") {
      if (state === "PLAYING") {
        state = "PAUSED";
        showOverlay("PAUSED");
      } else if (state === "PAUSED") {
        state = "PLAYING";
        overlay.classList.add("hidden");
      }
    }
  });
  document.addEventListener("keyup", (e) => { keys[e.code] = false; });

  overlay.addEventListener("click", () => {
    if (state === "START" || state === "GAME_OVER" || state === "PAUSED") {
      if (state === "PAUSED") {
        state = "PLAYING";
        overlay.classList.add("hidden");
      } else {
        startGame();
      }
    }
  });

  function update() {
    if (state !== "PLAYING") return;
    frameCount++;

    // Ship movement
    const shipSpeed = 4;
    if (keys["ArrowLeft"] || keys["KeyA"]) shipX -= shipSpeed;
    if (keys["ArrowRight"] || keys["KeyD"]) shipX += shipSpeed;
    shipX = Math.max(0, Math.min(W - SHIP_W, shipX));

    // Shooting
    if (shootCooldown > 0) shootCooldown--;
    if (keys["Space"] && shootCooldown <= 0) {
      bullets.push({ x: shipX + SHIP_W / 2 - 1, y: H - 40, dy: -6 });
      shootCooldown = 12;
      beep(880, 0.08, "sawtooth");
    }

    // Move bullets
    bullets = bullets.filter((b) => {
      b.y += b.dy;
      return b.y > -10;
    });

    // Move enemy bullets
    enemyBullets = enemyBullets.filter((b) => {
      b.y += b.dy;
      return b.y < H + 10;
    });

    // Enemy shooting
    enemyShootTimer++;
    const shootInterval = Math.max(30, 80 - wave * 8);
    if (enemyShootTimer >= shootInterval) {
      enemyShootTimer = 0;
      const alive = invaders.filter((inv) => inv.alive);
      if (alive.length > 0) {
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        enemyBullets.push({
          x: shooter.x + INVADER_W / 2,
          y: shooter.y + INVADER_H,
          dy: 2.5 + wave * 0.3,
        });
        beep(200, 0.06);
      }
    }

    // Move invaders
    let hitEdge = false;
    for (const inv of invaders) {
      if (!inv.alive) continue;
      inv.x += invaderDir * invaderSpeed;
      if (inv.x <= 5 || inv.x + INVADER_W >= W - 5) {
        hitEdge = true;
      }
    }
    if (hitEdge) {
      invaderDir *= -1;
      for (const inv of invaders) {
        if (inv.alive) inv.y += 12;
      }
    }

    // Bullet-invader collision
    for (const b of bullets) {
      for (const inv of invaders) {
        if (!inv.alive) continue;
        if (
          b.x >= inv.x && b.x <= inv.x + INVADER_W &&
          b.y >= inv.y && b.y <= inv.y + INVADER_H
        ) {
          inv.alive = false;
          b.y = -100;
          score += inv.points;
          scoreEl.textContent = score;
          spawnExplosion(inv.x + INVADER_W / 2, inv.y + INVADER_H / 2, inv.color);
          beep(150, 0.15);

          // Speed up remaining invaders
          const remaining = invaders.filter((i) => i.alive).length;
          if (remaining > 0) {
            invaderSpeed = (0.5 + wave * 0.15) * (1 + (invaders.length - remaining) / invaders.length * 2);
          }
          break;
        }
      }
    }

    // Enemy bullet-ship collision
    for (const b of enemyBullets) {
      if (
        b.x >= shipX && b.x <= shipX + SHIP_W &&
        b.y >= H - 35 && b.y <= H - 35 + SHIP_H
      ) {
        b.y = H + 100;
        lives--;
        livesEl.textContent = lives;
        spawnExplosion(shipX + SHIP_W / 2, H - 35 + SHIP_H / 2, CYAN);
        beep(80, 0.4);
        if (lives <= 0) {
          state = "GAME_OVER";
          showOverlay("GAME OVER");
          return;
        }
      }
    }

    // Invader reaches bottom
    for (const inv of invaders) {
      if (inv.alive && inv.y + INVADER_H >= H - 45) {
        state = "GAME_OVER";
        showOverlay("GAME OVER");
        return;
      }
    }

    // Wave clear
    if (invaders.every((i) => !i.alive)) {
      wave++;
      waveEl.textContent = wave;
      initWave();
      beep(1200, 0.2, "sine");
    }

    // Update particles
    particles = particles.filter((p) => {
      p.x += p.dx;
      p.y += p.dy;
      p.life--;
      return p.life > 0;
    });

    // Update stars
    for (const s of stars) {
      s.y += s.speed;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      s.brightness = 0.3 + Math.sin(frameCount * 0.02 + s.x) * 0.3;
    }
  }

  function draw() {
    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(208,208,255," + (0.3 + s.brightness * 0.5) + ")";
      ctx.fill();
    }

    // Invaders
    for (const inv of invaders) {
      if (!inv.alive) continue;
      const wobble = Math.sin(frameCount * 0.05 + inv.x * 0.01) > 0;
      const pattern = wobble ? inv.pattern : inv.pattern.map((row) => [...row].reverse());
      ctx.shadowColor = inv.color;
      ctx.shadowBlur = 6;
      drawPixelArt(pattern, inv.x, inv.y, inv.color, PIXEL);
      ctx.shadowBlur = 0;
    }

    // Ship
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 8;
    drawPixelArt(SHIP_PATTERN, shipX, H - 35, CYAN, PIXEL);
    ctx.shadowBlur = 0;

    // Player bullets (laser beam style)
    for (const b of bullets) {
      ctx.fillStyle = GREEN;
      ctx.shadowColor = GREEN;
      ctx.shadowBlur = 8;
      ctx.fillRect(b.x, b.y, 2, 8);
      ctx.shadowBlur = 0;
      // Glow trail
      ctx.fillStyle = "rgba(0,255,170,0.2)";
      ctx.fillRect(b.x - 1, b.y + 8, 4, 6);
    }

    // Enemy bullets (pulsing orbs)
    for (const b of enemyBullets) {
      const pulse = 1 + Math.sin(frameCount * 0.2) * 0.3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = PINK;
      ctx.shadowColor = PINK;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life / 30;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Ground line
    ctx.strokeStyle = "rgba(255,42,109,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 18);
    ctx.lineTo(W, H - 18);
    ctx.stroke();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  loop();
})();
