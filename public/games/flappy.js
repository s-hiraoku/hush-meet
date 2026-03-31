(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const speedEl = document.getElementById("speed");
  const resultEl = document.getElementById("result-text");

  const W = canvas.width;
  const H = canvas.height;

  const PINK = "#ff2a6d";
  const CYAN = "#00e5ff";
  const GREEN = "#00ffaa";
  const PURPLE = "#b44aff";
  const BG = "#020010";

  // Bird pixel art (8x8)
  const BIRD_PATTERN = [
    [0, 0, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 2, 2, 1, 0, 0],
    [1, 1, 1, 1, 2, 2, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 3, 3, 3, 1, 1, 0],
    [0, 0, 1, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ];
  const BIRD_COLORS = { 1: CYAN, 2: "#ffffff", 3: "#ffaa00" };

  const PIXEL = 3;
  const BIRD_SIZE = 8 * PIXEL;

  // Physics
  const GRAVITY = 0.45;
  const FLAP_FORCE = -7;
  const MAX_FALL = 8;

  // Pipes
  const PIPE_W = 50;
  const PIPE_GAP = 130;
  const PIPE_SPEED_BASE = 2.2;
  const PIPE_SPACING = 200;

  // Ground
  const GROUND_H = 30;
  const GROUND_Y = H - GROUND_H;

  // Stars
  const stars = [];
  for (let i = 0; i < 50; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * (GROUND_Y - 20),
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.3 + 0.1,
      brightness: Math.random(),
    });
  }

  // State
  let state = "START";
  let score = 0;
  let highScore = parseInt(localStorage.getItem("flappy_hi") || "0", 10);
  let bird = { x: 100, y: H / 2, vy: 0, angle: 0 };
  let pipes = [];
  let particles = [];
  let frameCount = 0;
  let pipeSpeed = PIPE_SPEED_BASE;
  let groundOffset = 0;

  bestEl.textContent = highScore;

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

  function drawBird(x, y, angle) {
    ctx.save();
    ctx.translate(x + BIRD_SIZE / 2, y + BIRD_SIZE / 2);
    ctx.rotate(angle);
    ctx.translate(-BIRD_SIZE / 2, -BIRD_SIZE / 2);
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 10;
    for (let r = 0; r < BIRD_PATTERN.length; r++) {
      for (let c = 0; c < BIRD_PATTERN[r].length; c++) {
        const v = BIRD_PATTERN[r][c];
        if (v) {
          ctx.fillStyle = BIRD_COLORS[v];
          ctx.fillRect(c * PIXEL, r * PIXEL, PIXEL, PIXEL);
        }
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawPipe(px, gapY) {
    // Top pipe
    const topH = gapY;
    // Bottom pipe
    const botY = gapY + PIPE_GAP;
    const botH = GROUND_Y - botY;

    // Pipe body with neon glow
    ctx.shadowColor = GREEN;
    ctx.shadowBlur = 8;

    // Top pipe
    ctx.fillStyle = GREEN;
    ctx.fillRect(px, 0, PIPE_W, topH);
    // Top pipe cap
    ctx.fillRect(px - 4, topH - 16, PIPE_W + 8, 16);

    // Bottom pipe
    ctx.fillRect(px, botY, PIPE_W, botH);
    // Bottom pipe cap
    ctx.fillRect(px - 4, botY, PIPE_W + 8, 16);

    ctx.shadowBlur = 0;

    // Inner shading - darker stripe
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(px + 6, 0, PIPE_W - 12, topH - 16);
    ctx.fillRect(px + 6, botY + 16, PIPE_W - 12, botH - 16);

    // Neon edge highlights
    ctx.strokeStyle = "rgba(0,255,170,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, 0, PIPE_W, topH);
    ctx.strokeRect(px - 4, topH - 16, PIPE_W + 8, 16);
    ctx.strokeRect(px, botY, PIPE_W, botH);
    ctx.strokeRect(px - 4, botY, PIPE_W + 8, 16);
  }

  function drawGround() {
    // Ground fill
    ctx.fillStyle = "#0a0028";
    ctx.fillRect(0, GROUND_Y, W, GROUND_H);

    // Ground top line (neon)
    ctx.strokeStyle = PINK;
    ctx.shadowColor = PINK;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Scrolling grid lines
    ctx.strokeStyle = "rgba(255,42,109,0.15)";
    ctx.lineWidth = 1;
    const step = 20;
    for (let gx = -step + (groundOffset % step); gx < W; gx += step) {
      ctx.beginPath();
      ctx.moveTo(gx, GROUND_Y);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    for (let gy = GROUND_Y + 10; gy < H; gy += 10) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }
  }

  function drawScanlines() {
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    for (let y = 0; y < H; y += 3) {
      ctx.fillRect(0, y, W, 1);
    }
  }

  function drawVignette() {
    const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.75);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function spawnPipe() {
    const minGap = 60;
    const maxGap = GROUND_Y - PIPE_GAP - 60;
    const gapY = minGap + Math.random() * (maxGap - minGap);
    pipes.push({ x: W + 10, gapY: gapY, scored: false });
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particles.push({
        x: x,
        y: y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 15 + Math.random() * 15,
        color: color,
        size: 1 + Math.random() * 2,
      });
    }
  }

  function resetGame() {
    score = 0;
    bird = { x: 100, y: H / 2, vy: 0, angle: 0 };
    pipes = [];
    particles = [];
    frameCount = 0;
    pipeSpeed = PIPE_SPEED_BASE;
    groundOffset = 0;
    scoreEl.textContent = 0;
    speedEl.textContent = 1;
  }

  function startGame() {
    resetGame();
    state = "PLAYING";
    overlay.classList.add("hidden");
    resultEl.textContent = "";
    // Spawn initial pipes
    spawnPipe();
  }

  function gameOver() {
    state = "GAME_OVER";
    spawnParticles(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2, PINK, 20);
    beep(100, 0.4, "sawtooth");
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("flappy_hi", String(highScore));
      bestEl.textContent = highScore;
      resultEl.textContent = "NEW BEST: " + score;
    } else {
      resultEl.textContent = "SCORE: " + score;
    }
    overlay.classList.remove("hidden");
  }

  function showOverlay(text) {
    resultEl.textContent = text;
    overlay.classList.remove("hidden");
  }

  function flap() {
    if (state === "PLAYING") {
      bird.vy = FLAP_FORCE;
      beep(600, 0.06, "sine");
      spawnParticles(bird.x, bird.y + BIRD_SIZE, CYAN, 4);
    }
  }

  // Input
  document.addEventListener("keydown", function (e) {
    if (e.code === "Space") {
      e.preventDefault();
      if (state === "START" || state === "GAME_OVER") {
        startGame();
      } else {
        flap();
      }
    }
  });

  canvas.addEventListener("click", function () {
    if (state === "PLAYING") {
      flap();
    }
  });

  overlay.addEventListener("click", function () {
    if (state === "START" || state === "GAME_OVER") {
      startGame();
    }
  });

  // Touch support
  canvas.addEventListener("touchstart", function (e) {
    e.preventDefault();
    if (state === "PLAYING") {
      flap();
    }
  });

  function collides(bx, by, bw, bh, px, py, pw, ph) {
    return bx < px + pw && bx + bw > px && by < py + ph && by + bh > py;
  }

  function update() {
    if (state !== "PLAYING") return;
    frameCount++;

    // Gravity
    bird.vy += GRAVITY;
    if (bird.vy > MAX_FALL) bird.vy = MAX_FALL;
    bird.y += bird.vy;

    // Bird angle based on velocity
    bird.angle = Math.max(-0.5, Math.min(bird.vy * 0.08, 1.2));

    // Ceiling
    if (bird.y < 0) {
      bird.y = 0;
      bird.vy = 0;
    }

    // Ground collision
    if (bird.y + BIRD_SIZE >= GROUND_Y) {
      bird.y = GROUND_Y - BIRD_SIZE;
      gameOver();
      return;
    }

    // Speed ramp - increase every 5 points
    pipeSpeed = PIPE_SPEED_BASE + Math.floor(score / 5) * 0.3;
    speedEl.textContent = (1 + Math.floor(score / 5)).toString();

    // Ground scroll
    groundOffset += pipeSpeed;

    // Move pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
      pipes[i].x -= pipeSpeed;

      // Score when pipe passes bird
      if (!pipes[i].scored && pipes[i].x + PIPE_W < bird.x) {
        pipes[i].scored = true;
        score++;
        scoreEl.textContent = score;
        beep(1000, 0.1, "sine");
        // Quick flash particles at score
        spawnParticles(bird.x + BIRD_SIZE, bird.y + BIRD_SIZE / 2, GREEN, 6);
      }

      // Remove off-screen pipes
      if (pipes[i].x + PIPE_W + 8 < 0) {
        pipes.splice(i, 1);
      }
    }

    // Spawn new pipes
    var lastPipe = pipes[pipes.length - 1];
    if (!lastPipe || lastPipe.x < W - PIPE_SPACING) {
      spawnPipe();
    }

    // Collision with pipes
    var bx = bird.x + 3;
    var by = bird.y + 3;
    var bw = BIRD_SIZE - 6;
    var bh = BIRD_SIZE - 6;
    for (var i = 0; i < pipes.length; i++) {
      var p = pipes[i];
      // Top pipe
      if (collides(bx, by, bw, bh, p.x, 0, PIPE_W, p.gapY)) {
        gameOver();
        return;
      }
      // Top pipe cap
      if (collides(bx, by, bw, bh, p.x - 4, p.gapY - 16, PIPE_W + 8, 16)) {
        gameOver();
        return;
      }
      // Bottom pipe
      var botY = p.gapY + PIPE_GAP;
      if (collides(bx, by, bw, bh, p.x, botY, PIPE_W, GROUND_Y - botY)) {
        gameOver();
        return;
      }
      // Bottom pipe cap
      if (collides(bx, by, bw, bh, p.x - 4, botY, PIPE_W + 8, 16)) {
        gameOver();
        return;
      }
    }

    // Update particles
    particles = particles.filter(function (p) {
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.05;
      p.life--;
      return p.life > 0;
    });

    // Update stars
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.brightness = 0.3 + Math.sin(frameCount * 0.02 + s.x) * 0.3;
    }
  }

  function draw() {
    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(208,208,255," + (0.3 + s.brightness * 0.5) + ")";
      ctx.fill();
    }

    // Pipes
    for (var i = 0; i < pipes.length; i++) {
      drawPipe(pipes[i].x, pipes[i].gapY);
    }

    // Ground
    drawGround();

    // Bird
    if (state === "PLAYING" || state === "GAME_OVER") {
      drawBird(bird.x, bird.y, bird.angle);
    } else {
      // Floating idle bird on start screen
      var idleY = H / 2 + Math.sin(frameCount * 0.05) * 10;
      drawBird(100, idleY, 0);
    }

    // Particles
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = p.life / 30;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Score display on canvas (big centered number during play)
    if (state === "PLAYING") {
      ctx.font = "bold 48px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillText(score.toString(), W / 2, 70);
    }

    // CRT effects
    drawScanlines();
    drawVignette();
  }

  function loop() {
    if (state === "START") {
      frameCount++;
    }
    update();
    draw();
    requestAnimationFrame(loop);
  }

  loop();
})();
