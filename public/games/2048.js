(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const resultEl = document.getElementById("result-text");

  const W = canvas.width;
  const H = canvas.height;

  // Colors
  const BG = "#05050f";
  const GRID_BG = "rgba(20,15,40,0.8)";
  const CELL_EMPTY = "rgba(40,30,70,0.5)";
  const NEON_GREEN = "#00ffaa";
  const NEON_CYAN = "#00e5ff";

  // Tile colors by value - neon retro palette
  const TILE_COLORS = {
    2: { bg: "#1a1a3e", fg: "#8888cc", glow: "rgba(136,136,204,0.4)" },
    4: { bg: "#1e1a40", fg: "#aa88ee", glow: "rgba(170,136,238,0.4)" },
    8: { bg: "#2a1a44", fg: "#ff6090", glow: "rgba(255,96,144,0.5)" },
    16: { bg: "#301848", fg: "#ff2a6d", glow: "rgba(255,42,109,0.5)" },
    32: { bg: "#381050", fg: "#ff2a6d", glow: "rgba(255,42,109,0.6)" },
    64: { bg: "#401060", fg: "#ff1050", glow: "rgba(255,16,80,0.6)" },
    128: { bg: "#0a2a3a", fg: "#00e5ff", glow: "rgba(0,229,255,0.5)" },
    256: { bg: "#0a3040", fg: "#00e5ff", glow: "rgba(0,229,255,0.6)" },
    512: { bg: "#0a3a2a", fg: "#00ffaa", glow: "rgba(0,255,170,0.5)" },
    1024: { bg: "#0a4030", fg: "#00ffaa", glow: "rgba(0,255,170,0.6)" },
    2048: { bg: "#2a1000", fg: "#ffcc00", glow: "rgba(255,204,0,0.7)" },
  };

  function getTileColor(val) {
    if (TILE_COLORS[val]) return TILE_COLORS[val];
    return { bg: "#3a1050", fg: "#ffcc00", glow: "rgba(255,204,0,0.7)" };
  }

  // Grid layout
  const GRID_SIZE = 4;
  const GRID_PAD = 24;
  const CELL_GAP = 10;
  const GRID_AREA = W - GRID_PAD * 2;
  const CELL_SIZE = (GRID_AREA - CELL_GAP * (GRID_SIZE + 1)) / GRID_SIZE;
  const GRID_TOP = (H - GRID_AREA) / 2 + 10;

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
  let state = "START"; // START, PLAYING, GAME_OVER, WIN, CONTINUE
  let grid = [];
  let score = 0;
  let best = parseInt(localStorage.getItem("hm2048best") || "0", 10);
  let mergeAnimations = []; // {r, c, t}
  let spawnAnimations = []; // {r, c, t}
  let particles = [];

  bestEl.textContent = best;

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

  function cellX(c) {
    return GRID_PAD + CELL_GAP + c * (CELL_SIZE + CELL_GAP);
  }
  function cellY(r) {
    return GRID_TOP + CELL_GAP + r * (CELL_SIZE + CELL_GAP);
  }

  function initGrid() {
    grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    mergeAnimations = [];
    spawnAnimations = [];
    particles = [];
  }

  function emptyPositions() {
    const positions = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === 0) positions.push({ r, c });
      }
    }
    return positions;
  }

  function spawnTile() {
    const empty = emptyPositions();
    if (empty.length === 0) return false;
    const pos = empty[Math.floor(Math.random() * empty.length)];
    grid[pos.r][pos.c] = Math.random() < 0.9 ? 2 : 4;
    spawnAnimations.push({ r: pos.r, c: pos.c, t: 8 });
    return true;
  }

  function spawnParticles(r, c, value) {
    const x = cellX(c) + CELL_SIZE / 2;
    const y = cellY(r) + CELL_SIZE / 2;
    const color = getTileColor(value).fg;
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      particles.push({
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 15 + Math.random() * 10,
        color,
      });
    }
  }

  function canMove() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === 0) return true;
        if (c < GRID_SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
        if (r < GRID_SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  function has2048() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] >= 2048) return true;
      }
    }
    return false;
  }

  // Rotate grid clockwise once
  function rotateCW(g) {
    const n = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        n[c][GRID_SIZE - 1 - r] = g[r][c];
      }
    }
    return n;
  }

  function rotateN(g, times) {
    let out = g;
    for (let t = 0; t < times % 4; t++) out = rotateCW(out);
    return out;
  }

  function copyGrid(g) {
    return g.map(function (row) {
      return row.slice();
    });
  }

  // Move logic - returns true if anything moved
  function move(direction) {
    // Save previous state
    const prev = copyGrid(grid);

    // Map rotations: left=0, up=1, right=2, down=3
    var rotations = { left: 0, up: 1, right: 2, down: 3 };
    var rot = rotations[direction];
    grid = rotateN(grid, rot);

    var moved = false;
    var mergedCells = []; // positions in rotated space

    // Slide every row left
    for (var r = 0; r < GRID_SIZE; r++) {
      var row = grid[r].filter(function (v) {
        return v !== 0;
      });
      var newRow = [];
      for (var i = 0; i < row.length; i++) {
        if (i < row.length - 1 && row[i] === row[i + 1]) {
          var merged = row[i] * 2;
          newRow.push(merged);
          score += merged;
          mergedCells.push({ r: r, c: newRow.length - 1, val: merged });
          i++;
        } else {
          newRow.push(row[i]);
        }
      }
      while (newRow.length < GRID_SIZE) newRow.push(0);
      for (var c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] !== newRow[c]) moved = true;
        grid[r][c] = newRow[c];
      }
    }

    // Rotate back
    grid = rotateN(grid, (4 - rot) % 4);

    // Map merged cell positions back to original orientation
    function unrotatePos(pr, pc, times) {
      var rr = pr,
        rc = pc;
      for (var t = 0; t < (4 - times) % 4; t++) {
        var tmp = rr;
        rr = rc;
        rc = GRID_SIZE - 1 - tmp;
      }
      return { r: rr, c: rc };
    }

    if (moved) {
      scoreEl.textContent = score;
      if (score > best) {
        best = score;
        bestEl.textContent = best;
        localStorage.setItem("hm2048best", String(best));
      }

      // Spawn merge animations and particles
      for (var m = 0; m < mergedCells.length; m++) {
        var pos = unrotatePos(mergedCells[m].r, mergedCells[m].c, rot);
        mergeAnimations.push({ r: pos.r, c: pos.c, t: 6 });
        spawnParticles(pos.r, pos.c, mergedCells[m].val);
      }

      if (mergedCells.length > 0) {
        beep(600 + Math.random() * 400, 0.08);
      }

      spawnTile();

      if (has2048() && state === "PLAYING") {
        state = "WIN";
        showOverlay("YOU REACHED 2048!");
        return true;
      }

      if (!canMove()) {
        state = "GAME_OVER";
        showOverlay("GAME OVER");
        return true;
      }
    }

    return moved;
  }

  function startGame() {
    score = 0;
    scoreEl.textContent = score;
    initGrid();
    spawnTile();
    spawnTile();
    state = "PLAYING";
    overlay.classList.add("hidden");
    resultEl.textContent = "";
  }

  function continueGame() {
    state = "CONTINUE";
    overlay.classList.add("hidden");
    resultEl.textContent = "";
  }

  function showOverlay(text) {
    resultEl.textContent = text;
    overlay.classList.remove("hidden");
    if (state === "WIN") {
      // Update hint to indicate player can continue
      const hint = overlay.querySelector(".start-hint");
      hint.textContent = "CLICK TO CONTINUE";
    } else {
      const hint = overlay.querySelector(".start-hint");
      hint.textContent = "CLICK TO START";
    }
  }

  // Input - keyboard
  document.addEventListener("keydown", function (e) {
    if (state !== "PLAYING" && state !== "CONTINUE") return;
    let dir = null;
    if (e.key === "ArrowLeft" || e.key === "a") dir = "left";
    else if (e.key === "ArrowRight" || e.key === "d") dir = "right";
    else if (e.key === "ArrowUp" || e.key === "w") dir = "up";
    else if (e.key === "ArrowDown" || e.key === "s") dir = "down";
    if (dir) {
      e.preventDefault();
      move(dir);
    }
  });

  // Input - touch/swipe
  let touchStartX = 0;
  let touchStartY = 0;
  canvas.addEventListener(
    "touchstart",
    function (e) {
      if (state !== "PLAYING" && state !== "CONTINUE") return;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      e.preventDefault();
    },
    { passive: false },
  );

  canvas.addEventListener(
    "touchend",
    function (e) {
      if (state !== "PLAYING" && state !== "CONTINUE") return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const absDX = Math.abs(dx);
      const absDY = Math.abs(dy);
      const MIN_SWIPE = 30;

      if (Math.max(absDX, absDY) < MIN_SWIPE) return;

      let dir = null;
      if (absDX > absDY) {
        dir = dx > 0 ? "right" : "left";
      } else {
        dir = dy > 0 ? "down" : "up";
      }
      if (dir) move(dir);
      e.preventDefault();
    },
    { passive: false },
  );

  // Overlay click
  overlay.addEventListener("click", function () {
    if (state === "START" || state === "GAME_OVER") {
      startGame();
    } else if (state === "WIN") {
      continueGame();
    }
  });

  // Drawing
  function drawGrid() {
    // Background grid pattern - subtle retro perspective lines
    ctx.strokeStyle = "rgba(26,10,106,0.12)";
    ctx.lineWidth = 0.5;
    const cx = W / 2;
    const vanishY = 60;
    for (let x = 0; x <= W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(cx, vanishY);
      ctx.stroke();
    }
    for (let y = H; y > vanishY; y -= 25) {
      const t = (y - vanishY) / (H - vanishY);
      const spread = t * (W / 2);
      ctx.beginPath();
      ctx.moveTo(cx - spread, y);
      ctx.lineTo(cx + spread, y);
      ctx.stroke();
    }
  }

  function drawRoundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawBoard() {
    // Grid background
    drawRoundRect(GRID_PAD, GRID_TOP, GRID_AREA, GRID_AREA, 8);
    ctx.fillStyle = GRID_BG;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,255,170,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Empty cells
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = cellX(c);
        const y = cellY(r);
        drawRoundRect(x, y, CELL_SIZE, CELL_SIZE, 4);
        ctx.fillStyle = CELL_EMPTY;
        ctx.fill();
      }
    }
  }

  function drawTiles() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const val = grid[r][c];
        if (val === 0) continue;

        const x = cellX(c);
        const y = cellY(r);
        const colors = getTileColor(val);

        // Check for spawn animation (scale up from small)
        let scale = 1;
        for (const anim of spawnAnimations) {
          if (anim.r === r && anim.c === c) {
            scale = 1 - (anim.t / 8) * 0.3;
          }
        }
        // Check for merge animation (brief scale-up pulse)
        for (const anim of mergeAnimations) {
          if (anim.r === r && anim.c === c) {
            scale = 1 + (anim.t / 6) * 0.15;
          }
        }

        ctx.save();
        const cx = x + CELL_SIZE / 2;
        const cy = y + CELL_SIZE / 2;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        // Tile background with glow
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = val >= 128 ? 16 : 8;
        drawRoundRect(x, y, CELL_SIZE, CELL_SIZE, 4);
        ctx.fillStyle = colors.bg;
        ctx.fill();

        // Border glow
        ctx.strokeStyle = colors.fg;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Text
        const text = String(val);
        let fontSize = 28;
        if (text.length === 2) fontSize = 26;
        else if (text.length === 3) fontSize = 22;
        else if (text.length >= 4) fontSize = 18;

        ctx.font = "bold " + fontSize + "px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = colors.fg;
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 10;
        ctx.fillText(text, cx, cy + 1);
        ctx.shadowBlur = 0;

        ctx.restore();
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 25;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function update() {
    // Update spawn animations
    spawnAnimations = spawnAnimations.filter(function (a) {
      a.t--;
      return a.t > 0;
    });

    // Update merge animations
    mergeAnimations = mergeAnimations.filter(function (a) {
      a.t--;
      return a.t > 0;
    });

    // Update particles
    particles = particles.filter(function (p) {
      p.x += p.dx;
      p.y += p.dy;
      p.life--;
      return p.life > 0;
    });
  }

  function draw() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    drawGrid();
    drawBoard();
    drawTiles();
    drawParticles();

    ctx.drawImage(scanCanvas, 0, 0);
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // Initialize and start render loop
  initGrid();
  loop();
})();
