(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const playerScoreEl = document.getElementById("player-score");
  const cpuScoreEl = document.getElementById("cpu-score");
  const turnEl = document.getElementById("turn-indicator");
  const resultEl = document.getElementById("result-text");

  const W = canvas.width;
  const H = canvas.height;

  // Colors
  const NEON_GREEN = "#00ffaa";
  const NEON_CYAN = "#00e5ff";
  const NEON_PINK = "#ff2a6d";
  const BG = "#05050f";
  const BOARD_BG = "#0a0a1a";
  const GRID_COLOR = "rgba(0, 229, 255, 0.15)";

  // Board config
  const BOARD_SIZE = 8;
  const CELL = W / BOARD_SIZE; // 60px per cell

  // Players
  const EMPTY = 0;
  const PLAYER = 1; // green
  const CPU = 2; // pink

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
  let state = "START"; // START, PLAYER_TURN, CPU_TURN, ANIMATING, GAME_OVER
  let board = [];
  let animations = []; // flip animations in progress
  let validMoves = [];
  let hoverCell = { r: -1, c: -1 };

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

  function beepPlace() {
    beep(600, 0.08);
  }
  function beepCapture() {
    beep(880, 0.12);
  }
  function beepGameOver() {
    beep(220, 0.5);
  }

  // ---- Board logic ----

  const DIRS = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  function initBoard() {
    board = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      board[r] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        board[r][c] = EMPTY;
      }
    }
    board[3][3] = CPU;
    board[3][4] = PLAYER;
    board[4][3] = PLAYER;
    board[4][4] = CPU;
  }

  function inBounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  }

  function opponent(p) {
    return p === PLAYER ? CPU : PLAYER;
  }

  function getFlips(b, r, c, player) {
    if (b[r][c] !== EMPTY) return [];
    let allFlips = [];
    const opp = opponent(player);
    for (const [dr, dc] of DIRS) {
      let flips = [];
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc) && b[nr][nc] === opp) {
        flips.push([nr, nc]);
        nr += dr;
        nc += dc;
      }
      if (flips.length > 0 && inBounds(nr, nc) && b[nr][nc] === player) {
        allFlips = allFlips.concat(flips);
      }
    }
    return allFlips;
  }

  function getValidMoves(b, player) {
    let moves = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (getFlips(b, r, c, player).length > 0) {
          moves.push([r, c]);
        }
      }
    }
    return moves;
  }

  function applyMove(b, r, c, player) {
    const flips = getFlips(b, r, c, player);
    b[r][c] = player;
    for (const [fr, fc] of flips) {
      b[fr][fc] = player;
    }
    return flips;
  }

  function cloneBoard(b) {
    return b.map((row) => row.slice());
  }

  function countPieces(b) {
    let p = 0,
      cpu = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (b[r][c] === PLAYER) p++;
        else if (b[r][c] === CPU) cpu++;
      }
    }
    return { player: p, cpu: cpu };
  }

  // ---- CPU AI: minimax with alpha-beta ----

  // Positional weight table for evaluation
  const WEIGHTS = [
    [100, -20, 10, 5, 5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [10, -2, 5, 1, 1, 5, -2, 10],
    [5, -2, 1, 1, 1, 1, -2, 5],
    [5, -2, 1, 1, 1, 1, -2, 5],
    [10, -2, 5, 1, 1, 5, -2, 10],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [100, -20, 10, 5, 5, 10, -20, 100],
  ];

  function evaluate(b) {
    let score = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (b[r][c] === CPU) score += WEIGHTS[r][c];
        else if (b[r][c] === PLAYER) score -= WEIGHTS[r][c];
      }
    }
    // Mobility bonus
    const cpuMoves = getValidMoves(b, CPU).length;
    const playerMoves = getValidMoves(b, PLAYER).length;
    score += (cpuMoves - playerMoves) * 5;
    return score;
  }

  function minimax(b, depth, alpha, beta, maximizing) {
    const currentPlayer = maximizing ? CPU : PLAYER;
    const moves = getValidMoves(b, currentPlayer);

    if (depth === 0) return evaluate(b);

    // If no moves, check if opponent can move
    if (moves.length === 0) {
      const oppMoves = getValidMoves(b, opponent(currentPlayer));
      if (oppMoves.length === 0) {
        // Game over
        const counts = countPieces(b);
        if (counts.cpu > counts.player) return 10000 + counts.cpu - counts.player;
        if (counts.player > counts.cpu) return -10000 - counts.player + counts.cpu;
        return 0;
      }
      // Pass turn
      return minimax(b, depth - 1, alpha, beta, !maximizing);
    }

    if (maximizing) {
      let maxEval = -Infinity;
      for (const [r, c] of moves) {
        const nb = cloneBoard(b);
        applyMove(nb, r, c, CPU);
        const ev = minimax(nb, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const [r, c] of moves) {
        const nb = cloneBoard(b);
        applyMove(nb, r, c, PLAYER);
        const ev = minimax(nb, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  function cpuChooseMove() {
    const moves = getValidMoves(board, CPU);
    if (moves.length === 0) return null;

    // Adaptive depth based on remaining empty cells
    let empty = 0;
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++) if (board[r][c] === EMPTY) empty++;

    let depth = empty <= 10 ? 6 : empty <= 20 ? 5 : 4;

    let bestMove = moves[0];
    let bestScore = -Infinity;
    for (const [r, c] of moves) {
      const nb = cloneBoard(board);
      applyMove(nb, r, c, CPU);
      const score = minimax(nb, depth - 1, -Infinity, Infinity, false);
      if (score > bestScore) {
        bestScore = score;
        bestMove = [r, c];
      }
    }
    return bestMove;
  }

  // ---- Animation ----

  function startFlipAnimation(flips, player) {
    animations = flips.map(([r, c]) => ({
      r,
      c,
      fromPlayer: opponent(player),
      toPlayer: player,
      t: 0, // 0 to 1
    }));
  }

  function updateAnimations(dt) {
    if (animations.length === 0) return false;
    let allDone = true;
    for (const anim of animations) {
      anim.t += dt * 3.5; // speed of flip
      if (anim.t < 1) allDone = false;
      else anim.t = 1;
    }
    if (allDone) {
      animations = [];
      return true; // done
    }
    return false; // still animating
  }

  // ---- Drawing ----

  function pieceColor(player) {
    return player === PLAYER ? NEON_GREEN : NEON_PINK;
  }

  function pieceGlow(player) {
    return player === PLAYER ? "rgba(0, 255, 170, 0.5)" : "rgba(255, 42, 109, 0.5)";
  }

  function drawBoard() {
    // Background
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let i = 0; i <= BOARD_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(W, i * CELL);
      ctx.stroke();
    }

    // Small dots at grid intersections (like a real board)
    ctx.fillStyle = "rgba(0, 229, 255, 0.2)";
    for (const pos of [2, 6]) {
      for (const pos2 of [2, 6]) {
        ctx.beginPath();
        ctx.arc(pos * CELL, pos2 * CELL, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPiece(cx, cy, player, scale) {
    if (scale === undefined) scale = 1;
    const radius = CELL * 0.38 * Math.abs(scale);
    if (radius < 1) return;

    const color = pieceColor(player);
    const glow = pieceGlow(player);

    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner highlight
    const grad = ctx.createRadialGradient(
      cx - radius * 0.25,
      cy - radius * 0.25,
      radius * 0.1,
      cx,
      cy,
      radius,
    );
    grad.addColorStop(0, "rgba(255,255,255,0.15)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  function drawPieces() {
    const animatingCells = new Set(animations.map((a) => a.r * BOARD_SIZE + a.c));

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === EMPTY) continue;
        if (animatingCells.has(r * BOARD_SIZE + c)) continue;
        const cx = c * CELL + CELL / 2;
        const cy = r * CELL + CELL / 2;
        drawPiece(cx, cy, board[r][c]);
      }
    }

    // Draw animating pieces with flip effect
    for (const anim of animations) {
      const cx = anim.c * CELL + CELL / 2;
      const cy = anim.r * CELL + CELL / 2;
      // Scale goes from 1 -> 0 -> 1 (horizontal squish)
      const scale = anim.t < 0.5 ? 1 - anim.t * 2 : (anim.t - 0.5) * 2;
      const showPlayer = anim.t < 0.5 ? anim.fromPlayer : anim.toPlayer;

      // Glow pulse during flip
      if (anim.t > 0.3 && anim.t < 0.7) {
        ctx.save();
        ctx.shadowColor = pieceGlow(anim.toPlayer);
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fill();
        ctx.restore();
      }

      drawPiece(cx, cy, showPlayer, scale);
    }
  }

  function drawValidMoves() {
    if (state !== "PLAYER_TURN") return;

    for (const [r, c] of validMoves) {
      const cx = c * CELL + CELL / 2;
      const cy = r * CELL + CELL / 2;
      const isHover = r === hoverCell.r && c === hoverCell.c;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.2, 0, Math.PI * 2);
      if (isHover) {
        ctx.fillStyle = "rgba(0, 255, 170, 0.25)";
        ctx.shadowColor = "rgba(0, 255, 170, 0.6)";
        ctx.shadowBlur = 15;
      } else {
        ctx.fillStyle = "rgba(0, 255, 170, 0.08)";
        ctx.shadowColor = "rgba(0, 255, 170, 0.3)";
        ctx.shadowBlur = 8;
      }
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFrame() {
    ctx.clearRect(0, 0, W, H);
    drawBoard();
    drawValidMoves();
    drawPieces();

    // Scanline overlay
    ctx.drawImage(scanCanvas, 0, 0);
  }

  // ---- Game flow ----

  function updateScores() {
    const counts = countPieces(board);
    playerScoreEl.textContent = counts.player;
    cpuScoreEl.textContent = counts.cpu;
  }

  function setTurnText(text) {
    turnEl.textContent = text;
  }

  function startGame() {
    initBoard();
    animations = [];
    updateScores();
    validMoves = getValidMoves(board, PLAYER);
    state = "PLAYER_TURN";
    setTurnText("YOUR TURN");
    overlay.classList.add("hidden");
    resultEl.textContent = "";
  }

  function showOverlay(text) {
    resultEl.textContent = text;
    overlay.classList.remove("hidden");
  }

  function checkGameOver() {
    const playerMoves = getValidMoves(board, PLAYER);
    const cpuMoves = getValidMoves(board, CPU);

    if (playerMoves.length === 0 && cpuMoves.length === 0) {
      // Game over
      const counts = countPieces(board);
      state = "GAME_OVER";
      setTurnText("GAME OVER");
      beepGameOver();
      if (counts.player > counts.cpu) {
        showOverlay("YOU WIN!  " + counts.player + " - " + counts.cpu);
      } else if (counts.cpu > counts.player) {
        showOverlay("CPU WINS  " + counts.cpu + " - " + counts.player);
      } else {
        showOverlay("DRAW!  " + counts.player + " - " + counts.cpu);
      }
      return true;
    }
    return false;
  }

  function afterPlayerMove() {
    updateScores();
    if (checkGameOver()) return;

    const cpuMoves = getValidMoves(board, CPU);
    if (cpuMoves.length > 0) {
      state = "CPU_TURN";
      setTurnText("CPU THINKING...");
      // Delay for natural feel
      setTimeout(executeCpuMove, 350 + Math.random() * 200);
    } else {
      // CPU has no moves, player goes again
      validMoves = getValidMoves(board, PLAYER);
      state = "PLAYER_TURN";
      setTurnText("YOUR TURN (CPU PASSED)");
    }
  }

  function executeCpuMove() {
    if (state !== "CPU_TURN") return;
    const move = cpuChooseMove();
    if (!move) {
      // Should not happen here but handle gracefully
      afterCpuMove();
      return;
    }
    const [r, c] = move;
    const flips = getFlips(board, r, c, CPU);
    applyMove(board, r, c, CPU);
    beepPlace();
    if (flips.length > 0) beepCapture();
    startFlipAnimation(flips, CPU);
    state = "ANIMATING";
    animDoneCallback = afterCpuMove;
  }

  function afterCpuMove() {
    updateScores();
    if (checkGameOver()) return;

    const playerMoves = getValidMoves(board, PLAYER);
    if (playerMoves.length > 0) {
      validMoves = playerMoves;
      state = "PLAYER_TURN";
      setTurnText("YOUR TURN");
    } else {
      // Player has no moves, CPU goes again
      state = "CPU_TURN";
      setTurnText("CPU THINKING... (YOU PASSED)");
      setTimeout(executeCpuMove, 350 + Math.random() * 200);
    }
  }

  let animDoneCallback = null;

  // ---- Input ----

  function getCellFromMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const c = Math.floor((x * scaleX) / CELL);
    const r = Math.floor((y * scaleY) / CELL);
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) return { r, c };
    return null;
  }

  canvas.addEventListener("mousemove", function (e) {
    const cell = getCellFromMouse(e);
    if (cell) {
      hoverCell = cell;
    } else {
      hoverCell = { r: -1, c: -1 };
    }
  });

  canvas.addEventListener("click", function (e) {
    if (state !== "PLAYER_TURN") return;
    const cell = getCellFromMouse(e);
    if (!cell) return;

    const { r, c } = cell;
    const flips = getFlips(board, r, c, PLAYER);
    if (flips.length === 0) return; // invalid move

    applyMove(board, r, c, PLAYER);
    beepPlace();
    if (flips.length > 0) beepCapture();
    startFlipAnimation(flips, PLAYER);
    state = "ANIMATING";
    animDoneCallback = afterPlayerMove;
  });

  overlay.addEventListener("click", function () {
    if (state === "START" || state === "GAME_OVER") {
      startGame();
    }
  });

  // ---- Main loop ----

  let lastTime = 0;

  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    // Update animations
    if (state === "ANIMATING") {
      const done = updateAnimations(dt);
      if (done && animDoneCallback) {
        const cb = animDoneCallback;
        animDoneCallback = null;
        cb();
      }
    }

    drawFrame();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(function (t) {
    lastTime = t;
    requestAnimationFrame(loop);
  });
})();
