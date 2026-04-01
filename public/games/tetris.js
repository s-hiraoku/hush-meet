(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const resultEl = document.getElementById("result-text");

  const W = canvas.width;
  const H = canvas.height;

  // Grid dimensions
  const COLS = 10;
  const ROWS = 20;
  const CELL = 30; // 300 / 10 = 30, 600 / 20 = 30
  const FIELD_X = 0; // playfield left edge
  const PANEL_X = 310; // side panel left edge
  const PANEL_W = W - PANEL_X;

  // Colors
  const BG = "#05050f";
  const NEON_GREEN = "#00ffaa";
  const NEON_CYAN = "#00e5ff";
  const NEON_PINK = "#ff2a6d";
  const GRID_COLOR = "rgba(0, 255, 170, 0.06)";

  // Tetromino definitions: [shape, color]
  // Each shape is array of 4 [row, col] offsets
  const PIECES = {
    I: { blocks: [[0,0],[0,1],[0,2],[0,3]], color: "#00e5ff" },
    O: { blocks: [[0,0],[0,1],[1,0],[1,1]], color: "#ffdd00" },
    T: { blocks: [[0,1],[1,0],[1,1],[1,2]], color: "#bf40ff" },
    S: { blocks: [[0,1],[0,2],[1,0],[1,1]], color: "#00ffaa" },
    Z: { blocks: [[0,0],[0,1],[1,1],[1,2]], color: "#ff2a6d" },
    J: { blocks: [[0,0],[1,0],[1,1],[1,2]], color: "#3377ff" },
    L: { blocks: [[0,2],[1,0],[1,1],[1,2]], color: "#ff8833" },
  };
  const PIECE_NAMES = Object.keys(PIECES);

  // Pre-render scanline overlay for canvas
  const scanCanvas = document.createElement("canvas");
  scanCanvas.width = W;
  scanCanvas.height = H;
  const scanCtx = scanCanvas.getContext("2d");
  for (let y = 0; y < H; y += 4) {
    scanCtx.fillStyle = "rgba(0,255,170,0.02)";
    scanCtx.fillRect(0, y + 2, W, 2);
  }

  // State
  let state = "START"; // START, PLAYING, GAMEOVER
  let score = 0;
  let level = 1;
  let lines = 0;
  let grid = []; // ROWS x COLS, null or color string
  let current = null; // { blocks, color, row, col }
  let nextPiece = null;
  let dropTimer = 0;
  let dropInterval = 1000; // ms per drop
  let lastTime = 0;
  let particles = [];
  let shakeFrames = 0;
  let bag = [];

  // Audio
  let audioCtx;
  function beep(freq, dur, type) {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.stop(audioCtx.currentTime + dur);
  }

  function soundRotate() { beep(600, 0.08); }
  function soundDrop() { beep(200, 0.12); }
  function soundLineClear() { beep(880, 0.2, "sine"); setTimeout(() => beep(1100, 0.15, "sine"), 100); }
  function soundGameOver() {
    beep(300, 0.3, "sawtooth");
    setTimeout(() => beep(200, 0.3, "sawtooth"), 150);
    setTimeout(() => beep(100, 0.5, "sawtooth"), 300);
  }

  // Bag randomizer: 7-bag system
  function nextFromBag() {
    if (bag.length === 0) {
      bag = PIECE_NAMES.slice();
      // Fisher-Yates shuffle
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function createPiece(name) {
    const def = PIECES[name];
    return {
      blocks: def.blocks.map(b => [b[0], b[1]]),
      color: def.color,
      row: 0,
      col: Math.floor(COLS / 2) - 1,
      name: name,
    };
  }

  function initGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid.push(new Array(COLS).fill(null));
    }
  }

  function isValid(blocks, row, col) {
    for (const [br, bc] of blocks) {
      const r = row + br;
      const c = col + bc;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
      if (grid[r][c] !== null) return false;
    }
    return true;
  }

  function rotateBlocks(blocks, name) {
    if (name === "O") return blocks.map(b => [b[0], b[1]]);
    // Find bounding box center and rotate 90 CW
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const [r, c] of blocks) {
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    }
    const cr = (minR + maxR) / 2;
    const cc = (minC + maxC) / 2;
    return blocks.map(([r, c]) => {
      const nr = Math.round(cc - cr + r - (c - cc) + (cr - cc));
      const nc = Math.round(cr - cc + c + (r - cr) - (cr - cc));
      // Simplified: rotate around center
      return [Math.round(cr + (c - cc)), Math.round(cc - (r - cr))];
    });
  }

  function lockPiece() {
    for (const [br, bc] of current.blocks) {
      const r = current.row + br;
      const c = current.col + bc;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        grid[r][c] = current.color;
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(cell => cell !== null)) {
        // Spawn particles along this row
        for (let c = 0; c < COLS; c++) {
          spawnParticles(FIELD_X + c * CELL + CELL / 2, r * CELL + CELL / 2, grid[r][c]);
        }
        grid.splice(r, 1);
        grid.unshift(new Array(COLS).fill(null));
        cleared++;
        r++; // recheck this row index
      }
    }
    if (cleared > 0) {
      soundLineClear();
      shakeFrames = 8;
      // Scoring: 100, 300, 500, 800
      const pts = [0, 100, 300, 500, 800];
      score += (pts[cleared] || 800) * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 80);
      scoreEl.textContent = score;
      levelEl.textContent = level;
    }
    return cleared;
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particles.push({
        x, y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 20 + Math.random() * 10,
        maxLife: 30,
        color: color,
      });
    }
  }

  function getGhostRow() {
    let ghostRow = current.row;
    while (isValid(current.blocks, ghostRow + 1, current.col)) {
      ghostRow++;
    }
    return ghostRow;
  }

  function spawnPiece() {
    current = nextPiece || createPiece(nextFromBag());
    nextPiece = createPiece(nextFromBag());
    // Check if spawn position is valid
    if (!isValid(current.blocks, current.row, current.col)) {
      // Game over
      lockPiece();
      state = "GAMEOVER";
      soundGameOver();
      showOverlay("SCORE: " + score);
    }
  }

  function hardDrop() {
    const ghostRow = getGhostRow();
    score += (ghostRow - current.row) * 2;
    current.row = ghostRow;
    scoreEl.textContent = score;
    lockPiece();
    soundDrop();
    clearLines();
    spawnPiece();
    dropTimer = 0;
  }

  function moveDown() {
    if (isValid(current.blocks, current.row + 1, current.col)) {
      current.row++;
      return true;
    }
    return false;
  }

  function moveLeft() {
    if (isValid(current.blocks, current.row, current.col - 1)) {
      current.col--;
    }
  }

  function moveRight() {
    if (isValid(current.blocks, current.row, current.col + 1)) {
      current.col++;
    }
  }

  function rotate() {
    const rotated = rotateBlocks(current.blocks, current.name);
    // Try normal position, then wall kicks
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (isValid(rotated, current.row, current.col + kick)) {
        current.blocks = rotated;
        current.col += kick;
        soundRotate();
        return;
      }
    }
  }

  function startGame() {
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 1000;
    dropTimer = 0;
    bag = [];
    scoreEl.textContent = score;
    levelEl.textContent = level;
    initGrid();
    nextPiece = null;
    spawnPiece();
    state = "PLAYING";
    overlay.classList.add("hidden");
    resultEl.textContent = "";
    lastTime = performance.now();
  }

  function showOverlay(text) {
    resultEl.textContent = text;
    overlay.classList.remove("hidden");
  }

  // --- Drawing ---

  function drawBlock(x, y, size, color, alpha) {
    const a = alpha !== undefined ? alpha : 1;
    ctx.save();
    ctx.globalAlpha = a;

    // Neon glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // Fill
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

    // Inner highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x + 2, y + 2, size - 6, 3);
    ctx.fillRect(x + 2, y + 2, 3, size - 6);

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);

    ctx.restore();
  }

  function drawGrid() {
    // Grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(FIELD_X + c * CELL, 0);
      ctx.lineTo(FIELD_X + c * CELL, ROWS * CELL);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(FIELD_X, r * CELL);
      ctx.lineTo(FIELD_X + COLS * CELL, r * CELL);
      ctx.stroke();
    }

    // Locked blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) {
          drawBlock(FIELD_X + c * CELL, r * CELL, CELL, grid[r][c]);
        }
      }
    }
  }

  function drawGhost() {
    if (!current) return;
    const ghostRow = getGhostRow();
    if (ghostRow === current.row) return;
    for (const [br, bc] of current.blocks) {
      const x = FIELD_X + (current.col + bc) * CELL;
      const y = (ghostRow + br) * CELL;
      drawBlock(x, y, CELL, current.color, 0.2);
    }
  }

  function drawCurrent() {
    if (!current) return;
    for (const [br, bc] of current.blocks) {
      const x = FIELD_X + (current.col + bc) * CELL;
      const y = (current.row + br) * CELL;
      drawBlock(x, y, CELL, current.color);
    }
  }

  function drawNextPiece() {
    // Panel background
    ctx.fillStyle = "rgba(0, 255, 170, 0.03)";
    ctx.fillRect(PANEL_X, 0, PANEL_W, H);

    // Divider line
    ctx.strokeStyle = "rgba(0, 255, 170, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PANEL_X, 0);
    ctx.lineTo(PANEL_X, H);
    ctx.stroke();

    // "NEXT" label
    ctx.save();
    ctx.font = "12px 'Courier New', monospace";
    ctx.fillStyle = NEON_CYAN;
    ctx.shadowColor = NEON_CYAN;
    ctx.shadowBlur = 6;
    ctx.textAlign = "center";
    ctx.fillText("NEXT", PANEL_X + PANEL_W / 2, 30);
    ctx.restore();

    // Draw next piece centered in panel
    if (!nextPiece) return;
    const previewSize = 20;
    // Find bounding box
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const [r, c] of nextPiece.blocks) {
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    }
    const pw = (maxC - minC + 1) * previewSize;
    const ph = (maxR - minR + 1) * previewSize;
    const ox = PANEL_X + (PANEL_W - pw) / 2 - minC * previewSize;
    const oy = 50 + (80 - ph) / 2 - minR * previewSize;

    for (const [br, bc] of nextPiece.blocks) {
      drawBlock(ox + bc * previewSize, oy + br * previewSize, previewSize, nextPiece.color);
    }

    // Lines count
    ctx.save();
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillStyle = "#6060aa";
    ctx.textAlign = "center";
    ctx.fillText("LINES", PANEL_X + PANEL_W / 2, 180);
    ctx.fillStyle = NEON_GREEN;
    ctx.shadowColor = NEON_GREEN;
    ctx.shadowBlur = 4;
    ctx.font = "16px 'Courier New', monospace";
    ctx.fillText(lines, PANEL_X + PANEL_W / 2, 200);
    ctx.restore();

    // Controls reminder
    ctx.save();
    ctx.font = "9px 'Courier New', monospace";
    ctx.fillStyle = "rgba(96,96,170,0.5)";
    ctx.textAlign = "center";
    const cx = PANEL_X + PANEL_W / 2;
    ctx.fillText("\u2190\u2192 MOVE", cx, H - 80);
    ctx.fillText("\u2191 ROTATE", cx, H - 65);
    ctx.fillText("\u2193 SOFT", cx, H - 50);
    ctx.fillText("SPC HARD", cx, H - 35);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.restore();
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.1;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function draw() {
    ctx.save();

    // Screen shake
    if (shakeFrames > 0) {
      const sx = (Math.random() - 0.5) * 4;
      const sy = (Math.random() - 0.5) * 4;
      ctx.translate(sx, sy);
      shakeFrames--;
    }

    // Clear
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    drawGrid();
    drawGhost();
    drawCurrent();
    drawNextPiece();
    drawParticles();

    // Scanline overlay
    ctx.drawImage(scanCanvas, 0, 0);

    ctx.restore();
  }

  // --- Game loop ---

  function update(time) {
    if (state !== "PLAYING") {
      draw();
      requestAnimationFrame(update);
      return;
    }

    const dt = time - lastTime;
    lastTime = time;

    dropTimer += dt;
    if (dropTimer >= dropInterval) {
      dropTimer -= dropInterval;
      if (!moveDown()) {
        // Lock piece
        lockPiece();
        soundDrop();
        clearLines();
        spawnPiece();
        dropTimer = 0;
      }
    }

    updateParticles();
    draw();
    requestAnimationFrame(update);
  }

  // --- Input ---

  document.addEventListener("keydown", function (e) {
    if (state !== "PLAYING") return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        moveLeft();
        break;
      case "ArrowRight":
        e.preventDefault();
        moveRight();
        break;
      case "ArrowUp":
        e.preventDefault();
        rotate();
        break;
      case "ArrowDown":
        e.preventDefault();
        if (moveDown()) {
          score += 1;
          scoreEl.textContent = score;
        }
        dropTimer = 0;
        break;
      case " ":
        e.preventDefault();
        hardDrop();
        break;
    }
  });

  overlay.addEventListener("click", function () {
    if (state === "START" || state === "GAMEOVER") {
      startGame();
    }
  });

  // Initial draw
  initGrid();
  requestAnimationFrame(update);
})();
