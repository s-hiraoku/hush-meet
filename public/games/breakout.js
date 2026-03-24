(function() {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const resultEl = document.getElementById("result-text");

  const W = canvas.width;
  const H = canvas.height;

  // Colors
  const NEON_GREEN = "#00ffaa";
  const NEON_CYAN = "#00e5ff";
  const BG = "#05050f";
  const BRICK_COLORS = ["#ff2a6d", "#ff6090", "#d1f7ff", "#00e5ff", "#00ffaa"];

  // Game config
  const PADDLE_W = 80;
  const PADDLE_H = 10;
  const BALL_R = 5;
  const BRICK_ROWS = 5;
  const BRICK_COLS = 10;
  const BRICK_W = (W - 40) / BRICK_COLS;
  const BRICK_H = 18;
  const BRICK_PAD = 3;
  const BRICK_TOP = 40;
  const BRICK_LEFT = 20;

  // Pre-render scanline overlay
  const scanCanvas = document.createElement("canvas");
  scanCanvas.width = W;
  scanCanvas.height = H;
  const scanCtx = scanCanvas.getContext("2d");
  for (let y = 0; y < H; y += 4) {
    scanCtx.fillStyle = "rgba(0,255,170,0.02)";
    scanCtx.fillRect(0, y + 2, W, 2);
  }

  // State
  let state = "START";
  let score = 0;
  let lives = 3;
  let paddleX = W / 2 - PADDLE_W / 2;
  let ballX, ballY, ballDX, ballDY;
  let bricks = [];
  let particles = [];
  let ballTrail = [];
  let shakeFrames = 0;

  // Audio
  let audioCtx;
  function beep(freq, dur) {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.stop(audioCtx.currentTime + dur);
  }

  function initBricks() {
    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_LEFT + c * BRICK_W,
          y: BRICK_TOP + r * (BRICK_H + BRICK_PAD),
          w: BRICK_W - BRICK_PAD,
          h: BRICK_H,
          color: BRICK_COLORS[r],
          hits: r < 2 ? 2 : 1,
          alive: true,
        });
      }
    }
  }

  function resetBall() {
    ballX = W / 2;
    ballY = H - 50;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    const speed = 4;
    ballDX = Math.cos(angle) * speed;
    ballDY = Math.sin(angle) * speed;
    ballTrail = [];
  }

  function startGame() {
    score = 0;
    lives = 3;
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    initBricks();
    resetBall();
    state = "PLAYING";
    overlay.classList.add("hidden");
    resultEl.textContent = "";
  }

  function showOverlay(text) {
    resultEl.textContent = text;
    overlay.classList.remove("hidden");
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particles.push({
        x, y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 20 + Math.random() * 10,
        color,
      });
    }
  }

  // Input
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    paddleX = e.clientX - rect.left - PADDLE_W / 2;
    paddleX = Math.max(0, Math.min(W - PADDLE_W, paddleX));
  });

  overlay.addEventListener("click", () => {
    if (state === "START" || state === "GAME_OVER" || state === "WIN" || state === "PAUSED") {
      if (state === "PAUSED") {
        state = "PLAYING";
        overlay.classList.add("hidden");
      } else {
        startGame();
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (state === "PLAYING") {
        state = "PAUSED";
        showOverlay("PAUSED");
      } else if (state === "PAUSED") {
        state = "PLAYING";
        overlay.classList.add("hidden");
      }
    }
  });

  function update() {
    if (state !== "PLAYING") return;

    ballTrail.push({ x: ballX, y: ballY });
    if (ballTrail.length > 8) ballTrail.shift();

    ballX += ballDX;
    ballY += ballDY;

    if (ballX - BALL_R < 0) { ballX = BALL_R; ballDX = Math.abs(ballDX); beep(300, 0.05); }
    if (ballX + BALL_R > W) { ballX = W - BALL_R; ballDX = -Math.abs(ballDX); beep(300, 0.05); }
    if (ballY - BALL_R < 0) { ballY = BALL_R; ballDY = Math.abs(ballDY); beep(300, 0.05); }

    if (ballY + BALL_R > H) {
      lives--;
      livesEl.textContent = lives;
      beep(120, 0.3);
      if (lives <= 0) {
        state = "GAME_OVER";
        showOverlay("GAME OVER");
        return;
      }
      resetBall();
      return;
    }

    if (
      ballY + BALL_R >= H - 30 - PADDLE_H &&
      ballY + BALL_R <= H - 30 &&
      ballX >= paddleX &&
      ballX <= paddleX + PADDLE_W &&
      ballDY > 0
    ) {
      const hitPos = (ballX - paddleX) / PADDLE_W;
      const angle = -Math.PI / 2 + (hitPos - 0.5) * 1.2;
      const speed = Math.sqrt(ballDX * ballDX + ballDY * ballDY);
      const newSpeed = Math.min(speed + 0.02, 7);
      ballDX = Math.cos(angle) * newSpeed;
      ballDY = Math.sin(angle) * newSpeed;
      ballY = H - 30 - PADDLE_H - BALL_R;
      beep(500, 0.05);
    }

    for (const brick of bricks) {
      if (!brick.alive) continue;
      if (
        ballX + BALL_R > brick.x &&
        ballX - BALL_R < brick.x + brick.w &&
        ballY + BALL_R > brick.y &&
        ballY - BALL_R < brick.y + brick.h
      ) {
        brick.hits--;
        if (brick.hits <= 0) {
          brick.alive = false;
          score += 10;
          spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color);
        } else {
          score += 5;
          brick.color = "#6060aa";
        }
        scoreEl.textContent = score;
        shakeFrames = 4;
        beep(700 + Math.random() * 300, 0.08);

        const overlapLeft = ballX + BALL_R - brick.x;
        const overlapRight = brick.x + brick.w - (ballX - BALL_R);
        const overlapTop = ballY + BALL_R - brick.y;
        const overlapBottom = brick.y + brick.h - (ballY - BALL_R);
        const minOverlapX = Math.min(overlapLeft, overlapRight);
        const minOverlapY = Math.min(overlapTop, overlapBottom);
        if (minOverlapX < minOverlapY) {
          ballDX = -ballDX;
        } else {
          ballDY = -ballDY;
        }
        break;
      }
    }

    if (bricks.every((b) => !b.alive)) {
      state = "WIN";
      showOverlay("YOU WIN!");
    }

    particles = particles.filter((p) => {
      p.x += p.dx;
      p.y += p.dy;
      p.life--;
      return p.life > 0;
    });

    if (shakeFrames > 0) shakeFrames--;
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(26,10,106,0.15)";
    ctx.lineWidth = 0.5;
    const cx = W / 2;
    const vanishY = 80;
    for (let x = 0; x <= W; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(cx, vanishY);
      ctx.stroke();
    }
    for (let y = H; y > vanishY; y -= 20) {
      const t = (y - vanishY) / (H - vanishY);
      const spread = t * (W / 2);
      ctx.beginPath();
      ctx.moveTo(cx - spread, y);
      ctx.lineTo(cx + spread, y);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.save();
    if (shakeFrames > 0) {
      ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    }

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    drawGrid();

    for (const brick of bricks) {
      if (!brick.alive) continue;
      ctx.fillStyle = brick.color;
      ctx.shadowColor = brick.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.shadowBlur = 0;
    }

    for (let i = 0; i < ballTrail.length; i++) {
      const alpha = (i / ballTrail.length) * 0.4;
      const r = BALL_R * (i / ballTrail.length) * 0.7;
      ctx.beginPath();
      ctx.arc(ballTrail[i].x, ballTrail[i].y, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,255,170," + alpha + ")";
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = NEON_GREEN;
    ctx.shadowColor = NEON_GREEN;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    const paddleY = H - 30;
    ctx.fillStyle = NEON_CYAN;
    ctx.shadowColor = NEON_CYAN;
    ctx.shadowBlur = 10;
    ctx.fillRect(paddleX, paddleY - PADDLE_H, PADDLE_W, PADDLE_H);
    ctx.shadowBlur = 0;

    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 30;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.drawImage(scanCanvas, 0, 0);
    ctx.restore();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  resetBall();
  loop();
})();
