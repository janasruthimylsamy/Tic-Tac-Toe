
"use strict";

/* ==========================================
   TIC TAC TOE - COMPLETE GAME SCRIPT
   AI + FRIEND + MINIMAX + UNDO + HISTORY
========================================== */

/* ---------- HELPERS ---------- */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

const STORAGE_KEYS = {
  preferences: "ticTacToePreferences",
  history: "ticTacToeHistory",
  scores: "ticTacToeScores"
};

const DEFAULT_ACCENT = "#a78bfa";
const DEFAULT_BACKGROUND = "#171326";

/* ---------- STORAGE ---------- */

function loadStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.warn("Storage loading error:", error);
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Storage saving error:", error);
  }
}

/* ---------- SAVED DATA ---------- */

const savedPreferences = loadStorage(
  STORAGE_KEYS.preferences,
  {}
);

let matchHistory = loadStorage(
  STORAGE_KEYS.history,
  []
);

let scores = loadStorage(
  STORAGE_KEYS.scores,
  {
    ai: { wins: 0, losses: 0, draws: 0 },
    friend: { x: 0, o: 0, draws: 0 }
  }
);

/* ---------- STATE ---------- */

const state = {
  mode: "ai",
  difficulty: "medium",
  humanSymbol: "X",

  currentPlayer: "X",

  board: Array(9).fill(""),
  moveHistory: [],

  gameOver: false,
  busy: false,

  round: 1,
  commentaryNumber: 0,

  soundEnabled: savedPreferences.soundEnabled !== false,
  lightMode: savedPreferences.lightMode === true,

  accent: savedPreferences.accent || DEFAULT_ACCENT,
  background: savedPreferences.background || DEFAULT_BACKGROUND,

  lastResult: null,
  lastSavedMatchId: null
};

let aiTimer = null;
let audioContext = null;

/* ==========================================
   INITIALIZATION
========================================== */

document.addEventListener("DOMContentLoaded", initializeGame);

function initializeGame() {
  createBoardIfMissing();
  attachEventListeners();

  applyPreferences();
  syncSettings();

  renderHistory();
  updateScoreboard();

  startRound(false);
}

/* ---------- CREATE BOARD ---------- */

function createBoardIfMissing() {
  const board = $("#board");

  if (!board) {
    console.error("Cannot find #board in HTML.");
    return;
  }

  if (board.querySelectorAll(".cell").length === 0) {
    board.innerHTML = "";

    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("button");

      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = i;
      cell.setAttribute("aria-label", `Cell ${i + 1}, empty`);

      board.appendChild(cell);
    }
  }
}

/* ==========================================
   EVENT LISTENERS
========================================== */

function attachEventListeners() {
  /* Board */

  $("#board")?.addEventListener("click", (event) => {
    const cell = event.target.closest(".cell");

    if (!cell) return;

    const index = Number(cell.dataset.index);

    if (Number.isInteger(index)) {
      handlePlayerMove(index);
    }
  });

  /* Main buttons */

  $("#newRoundButton")?.addEventListener("click", () => {
    startRound(true);
  });

  $("#undoButton")?.addEventListener("click", undoMove);

  $("#resetScores")?.addEventListener("click", resetScores);

  $("#clearHistory")?.addEventListener("click", clearHistory);

  /* Settings */

  $("#modeSetting")?.addEventListener("change", (event) => {
    changeMode(event.target.value);
  });

  $("#difficultySetting")?.addEventListener("change", (event) => {
    state.difficulty = event.target.value;
    startRound(false);
  });

  $("#symbolSetting")?.addEventListener("change", (event) => {
    changeSymbol(event.target.value);
  });

  /* Mode buttons */

  $$("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      changeMode(button.dataset.mode);

      $$("[data-mode]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
    });
  });

  /* Symbol buttons */

  $$("[data-symbol]").forEach((button) => {
    button.addEventListener("click", () => {
      changeSymbol(button.dataset.symbol);

      $$("[data-symbol]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
    });
  });

  /* Difficulty buttons */

  $$("[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      state.difficulty = button.dataset.difficulty;

      $$("[data-difficulty]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      startRound(false);
    });
  });

  /* Theme and sound */

  $("#soundToggle")?.addEventListener("click", toggleSound);

  $("#themeToggle")?.addEventListener("click", toggleTheme);

  $("#accentColor")?.addEventListener("input", (event) => {
    state.accent = event.target.value;
    applyPreferences();
    savePreferences();
  });

  $("#backgroundColor")?.addEventListener("input", (event) => {
    state.background = event.target.value;
    applyPreferences();
    savePreferences();
  });

  /* Result modal */

  $("#closeResultModal")?.addEventListener("click", closeResultModal);

  $("#playAgainButton")?.addEventListener("click", () => {
    closeResultModal();
    startRound(true);
  });

  $("#resultModal")?.addEventListener("click", (event) => {
    if (event.target.id === "resultModal") {
      closeResultModal();
    }
  });

  /* Match history */

  $("#historyList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-match-id]");

    if (!button) return;

    openMatchDetails(button.dataset.matchId);
  });

  $("#closeMatchDetails")?.addEventListener(
    "click",
    closeMatchDetails
  );
}

/* ==========================================
   CHANGE SETTINGS
========================================== */

function changeMode(mode) {
  if (!["ai", "friend"].includes(mode)) return;

  state.mode = mode;

  syncSettings();
  startRound(false);
}

function changeSymbol(symbol) {
  if (!["X", "O"].includes(symbol)) return;

  state.humanSymbol = symbol;

  syncSettings();
  startRound(false);
}

function syncSettings() {
  const modeSetting = $("#modeSetting");
  const symbolSetting = $("#symbolSetting");
  const difficultySetting = $("#difficultySetting");

  if (modeSetting) modeSetting.value = state.mode;
  if (symbolSetting) symbolSetting.value = state.humanSymbol;

  if (difficultySetting) {
    difficultySetting.value = state.difficulty;
  }

  const symbolGroup = $("#symbolSetting")?.closest(".setting-group");
  const difficultyGroup = $("#difficultySetting")?.closest(".setting-group");

  symbolGroup?.classList.toggle("hidden", state.mode !== "ai");
  difficultyGroup?.classList.toggle("hidden", state.mode !== "ai");

  updateScoreboard();
}

/* ==========================================
   START ROUND
========================================== */

function startRound(incrementRound = true) {
  clearTimeout(aiTimer);

  if (incrementRound) {
    state.round++;
  }

  state.board = Array(9).fill("");
  state.moveHistory = [];

  state.gameOver = false;
  state.busy = false;

  state.lastResult = null;
  state.lastSavedMatchId = null;

  state.currentPlayer = "X";
  state.commentaryNumber = 0;

  closeResultModal();
  resetGameResultBanner();

  syncSettings();

  renderBoard();
  updateTurnIndicator();
  updateRoundHeading();
  updateUndoButton();

  addCommentary(
    state.mode === "ai"
      ? "🎮 A new match begins! Let's see who takes the victory."
      : "🎮 New two-player match! Player X takes the first turn."
  );

  /*
    When the human selects O, AI plays X first.
  */

  if (state.mode === "ai" && state.humanSymbol === "O") {
    state.busy = true;

    renderBoard();
    updateTurnIndicator();
    updateUndoButton();

    aiTimer = setTimeout(() => {
      state.busy = false;
      makeAiMove();
    }, 450);
  }
}

/* ==========================================
   PLAYER MOVE
========================================== */

function handlePlayerMove(index) {
  if (state.gameOver || state.busy) return;

  if (state.board[index] !== "") return;

  if (
    state.mode === "ai" &&
    state.currentPlayer !== state.humanSymbol
  ) {
    return;
  }

  const symbol = state.currentPlayer;

  makeMove(index, symbol);

  if (state.gameOver) return;

  if (state.mode === "ai") {
    state.busy = true;

    renderBoard();
    updateTurnIndicator();
    updateUndoButton();

    aiTimer = setTimeout(() => {
      state.busy = false;
      makeAiMove();
    }, 450);
  }
}

/* ==========================================
   MAKE MOVE
========================================== */

function makeMove(index, symbol) {
  if (
    state.board[index] !== "" ||
    state.gameOver
  ) {
    return;
  }

  state.board[index] = symbol;

  state.moveHistory.push({
    index,
    symbol
  });

  playSound("move");

  const result = checkGameResult(state.board);

  if (result.winner) {
    state.gameOver = true;
    finishGame(result.winner, result.combo);
    return;
  }

  if (result.draw) {
    state.gameOver = true;
    finishGame("draw");
    return;
  }

  const commentary = getMoveCommentary(index, symbol);

  addCommentary(commentary);

  /*
    IMPORTANT:
    Switch player before rendering.
    This fixes the disabled board problem.
  */

  state.currentPlayer = symbol === "X" ? "O" : "X";

  renderBoard();
  updateTurnIndicator();
  updateRoundHeading();
  updateUndoButton();
}

/* ==========================================
   AI MOVE
========================================== */

function makeAiMove() {
  if (state.gameOver || state.mode !== "ai") return;

  if (state.currentPlayer === state.humanSymbol) return;

  const aiSymbol = state.humanSymbol === "X" ? "O" : "X";

  let move;

  switch (state.difficulty) {
    case "easy":
      move = getRandomMove();
      break;

    case "medium":
      move = getMediumMove(aiSymbol);
      break;

    case "hard":
      move = getBestMove(aiSymbol);
      break;

    default:
      move = getMediumMove(aiSymbol);
  }

  if (move === null || move === undefined) return;

  makeMove(move, aiSymbol);
}

/* ==========================================
   EASY AI
========================================== */

function getRandomMove() {
  const available = getAvailableMoves(state.board);

  if (!available.length) return null;

  return available[
    Math.floor(Math.random() * available.length)
  ];
}

/* ==========================================
   MEDIUM AI
========================================== */

function getMediumMove(aiSymbol) {
  const humanSymbol = state.humanSymbol;

  const winningMove = findImmediateMove(
    state.board,
    aiSymbol
  );

  if (winningMove !== null) return winningMove;

  const blockingMove = findImmediateMove(
    state.board,
    humanSymbol
  );

  if (blockingMove !== null) return blockingMove;

  if (state.board[4] === "") return 4;

  const corners = [0, 2, 6, 8].filter(
    (index) => state.board[index] === ""
  );

  if (corners.length) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  return getRandomMove();
}

/* ==========================================
   FIND IMMEDIATE WIN OR BLOCK
========================================== */

function findImmediateMove(board, symbol) {
  for (const index of getAvailableMoves(board)) {
    const testBoard = [...board];

    testBoard[index] = symbol;

    if (checkGameResult(testBoard).winner === symbol) {
      return index;
    }
  }

  return null;
}

/* ==========================================
   HARD AI - MINIMAX
========================================== */

function getBestMove(aiSymbol) {
  let bestScore = -Infinity;
  let bestMove = null;

  const humanSymbol = aiSymbol === "X" ? "O" : "X";

  for (const index of getAvailableMoves(state.board)) {
    const testBoard = [...state.board];

    testBoard[index] = aiSymbol;

    const score = minimax(
      testBoard,
      0,
      false,
      aiSymbol,
      humanSymbol
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = index;
    }
  }

  return bestMove;
}

function minimax(
  board,
  depth,
  isMaximizing,
  aiSymbol,
  humanSymbol
) {
  const result = checkGameResult(board);

  if (result.winner === aiSymbol) {
    return 10 - depth;
  }

  if (result.winner === humanSymbol) {
    return depth - 10;
  }

  if (result.draw) {
    return 0;
  }

  const available = getAvailableMoves(board);

  if (isMaximizing) {
    let bestScore = -Infinity;

    for (const index of available) {
      const newBoard = [...board];

      newBoard[index] = aiSymbol;

      const score = minimax(
        newBoard,
        depth + 1,
        false,
        aiSymbol,
        humanSymbol
      );

      bestScore = Math.max(bestScore, score);
    }

    return bestScore;
  }

  let bestScore = Infinity;

  for (const index of available) {
    const newBoard = [...board];

    newBoard[index] = humanSymbol;

    const score = minimax(
      newBoard,
      depth + 1,
      true,
      aiSymbol,
      humanSymbol
    );

    bestScore = Math.min(bestScore, score);
  }

  return bestScore;
}

/* ==========================================
   GAME RESULT CHECK
========================================== */

function checkGameResult(board) {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;

    if (
      board[a] &&
      board[a] === board[b] &&
      board[b] === board[c]
    ) {
      return {
        winner: board[a],
        combo,
        draw: false
      };
    }
  }

  if (board.every((cell) => cell !== "")) {
    return {
      winner: null,
      combo: null,
      draw: true
    };
  }

  return {
    winner: null,
    combo: null,
    draw: false
  };
}

function getAvailableMoves(board) {
  return board
    .map((value, index) => value === "" ? index : null)
    .filter((index) => index !== null);
}

/* ==========================================
   BOARD DISPLAY
========================================== */

function renderBoard(winningCombo = null) {
  $$(".cell").forEach((cell, index) => {
    const symbol = state.board[index];

    cell.textContent = symbol;

    cell.classList.toggle("filled", Boolean(symbol));
    cell.classList.toggle("x", symbol === "X");
    cell.classList.toggle("o", symbol === "O");

    const isHumanTurn =
      state.mode === "friend" ||
      state.currentPlayer === state.humanSymbol;

    cell.disabled =
      Boolean(symbol) ||
      state.gameOver ||
      state.busy ||
      !isHumanTurn;

    cell.classList.remove("winner-cell", "dimmed");

    cell.setAttribute(
      "aria-label",
      symbol
        ? `Cell ${index + 1}, ${symbol}`
        : `Cell ${index + 1}, empty`
    );

    if (winningCombo) {
      if (winningCombo.includes(index)) {
        cell.classList.add("winner-cell");
      } else {
        cell.classList.add("dimmed");
      }
    }
  });
}

/* ==========================================
   LIVE COMMENTARY
========================================== */

function getMoveCommentary(index, symbol) {
  const opponent = symbol === "X" ? "O" : "X";

  const positions = [
    "top-left corner",
    "top-middle",
    "top-right corner",
    "middle-left",
    "centre",
    "middle-right",
    "bottom-left corner",
    "bottom-middle",
    "bottom-right corner"
  ];

  const boardBeforeMove = [...state.board];
  boardBeforeMove[index] = "";

  const opponentThreat = findImmediateMove(
    boardBeforeMove,
    opponent
  );

  if (opponentThreat === index) {
    return `🛡️ Excellent defence! ${symbol} blocks a dangerous move.`;
  }

  if (index === 4) {
    return `🎯 Smart move! ${symbol} takes control of the centre.`;
  }

  if ([0, 2, 6, 8].includes(index)) {
    return `✨ ${symbol} chooses the ${positions[index]}. A strategic move!`;
  }

  if (state.moveHistory.length <= 2) {
    return `🚀 The match is getting started! ${symbol} makes a move.`;
  }

  return `♟️ ${symbol} plays at ${positions[index]}. The competition is heating up!`;
}

function addCommentary(message) {
  const container =
    $("#commentaryList") ||
    $("#commentary");

  if (!container) return;

  state.commentaryNumber++;

  const item = document.createElement("p");

  item.className = "commentary-item";
  item.textContent = message;

  container.prepend(item);

  while (container.children.length > 6) {
    container.removeChild(container.lastChild);
  }
}

/* ==========================================
   FINISH GAME
========================================== */

function finishGame(winner, winningCombo = null) {
  state.gameOver = true;
  state.busy = false;
  state.lastResult = winner;

  renderBoard(winningCombo);

  if (winner === "draw") {
    addCommentary("🤝 What a close match! It's a draw!");

    if (state.mode === "ai") {
      scores.ai.draws++;
    } else {
      scores.friend.draws++;
    }
  } else {
    addCommentary(`🏆 Incredible finish! Player ${winner} wins!`);

    if (state.mode === "ai") {
      if (winner === state.humanSymbol) {
        scores.ai.wins++;
      } else {
        scores.ai.losses++;
      }
    } else {
      if (winner === "X") {
        scores.friend.x++;
      } else {
        scores.friend.o++;
      }
    }
  }

  saveStorage(STORAGE_KEYS.scores, scores);

  updateScoreboard();
  updateGameResultBanner(winner);

  saveMatchHistory(winner);

  showResultModal(winner);

  playSound(winner === "draw" ? "draw" : "win");

  updateTurnIndicator();
  updateUndoButton();
}

/* ==========================================
   UNDO - CORRECTED VERSION
========================================== */

function undoMove() {
  if (state.busy) return;

  if (state.moveHistory.length === 0) return;

  clearTimeout(aiTimer);

  /*
    If a completed match is being undone,
    reverse its score and remove its history entry.
  */

  if (state.gameOver) {
    reverseLastResult();
  }

  if (state.mode === "ai") {
    /*
      AI mode:
      Remove the last AI move and the human move
      that came before it.

      This restores the human's previous turn.
    */

    if (state.moveHistory.length < 2) {
      /*
        This is usually the AI's opening move
        when the human selected O.

        Keep the opening move because it is
        the AI's first turn.
      */

      updateUndoButton();
      return;
    }

    const lastMove = state.moveHistory.pop();
    state.board[lastMove.index] = "";

    const previousMove = state.moveHistory.pop();
    state.board[previousMove.index] = "";

    state.currentPlayer = state.humanSymbol;
  } else {
    /*
      Friend mode:
      Remove exactly one move.
    */

    const lastMove = state.moveHistory.pop();

    state.board[lastMove.index] = "";

    state.currentPlayer =
      lastMove.symbol === "X" ? "X" : "O";
  }

  state.gameOver = false;
  state.busy = false;
  state.lastResult = null;
  state.lastSavedMatchId = null;

  closeResultModal();
  resetGameResultBanner();

  renderBoard();
  updateTurnIndicator();
  updateUndoButton();
  updateRoundHeading();

  addCommentary("↩️ Previous move undone. Your turn!");
}

/* ---------- REVERSE RESULT ---------- */

function reverseLastResult() {
  const winner = state.lastResult;

  if (!winner) return;

  if (winner === "draw") {
    if (state.mode === "ai") {
      scores.ai.draws = Math.max(0, scores.ai.draws - 1);
    } else {
      scores.friend.draws = Math.max(0, scores.friend.draws - 1);
    }
  } else if (state.mode === "ai") {
    if (winner === state.humanSymbol) {
      scores.ai.wins = Math.max(0, scores.ai.wins - 1);
    } else {
      scores.ai.losses = Math.max(0, scores.ai.losses - 1);
    }
  } else {
    if (winner === "X") {
      scores.friend.x = Math.max(0, scores.friend.x - 1);
    } else {
      scores.friend.o = Math.max(0, scores.friend.o - 1);
    }
  }

  if (state.lastSavedMatchId !== null) {
    matchHistory = matchHistory.filter(
      (match) => match.id !== state.lastSavedMatchId
    );

    saveStorage(STORAGE_KEYS.history, matchHistory);
    renderHistory();
  }

  saveStorage(STORAGE_KEYS.scores, scores);
  updateScoreboard();
}

/* ---------- UNDO BUTTON STATE ---------- */

function updateUndoButton() {
  const button = $("#undoButton");

  if (!button) return;

  let canUndo = false;

  if (state.mode === "friend") {
    canUndo = state.moveHistory.length > 0;
  } else {
    /*
      In AI mode, two moves are required:
      one human move and one AI response.
    */

    canUndo = state.moveHistory.length >= 2;
  }

  button.disabled = state.busy || !canUndo;

  button.setAttribute(
    "aria-label",
    "Undo last turn"
  );
}

/* ==========================================
   RESULT BANNER ABOVE BOARD
========================================== */

function updateGameResultBanner(winner) {
  const banner = $("#gameResultBanner");
  const title = $("#gameResultTitle");
  const description = $("#gameResultDescription");

  if (!banner || !title || !description) return;

  banner.classList.remove("winner", "draw");

  if (winner === "draw") {
    banner.classList.add("draw");

    title.textContent = "🤝 It's a Draw!";

    description.textContent =
      "What a close match! Both players gave their best.";
  } else {
    banner.classList.add("winner");

    title.textContent = `🏆 Player ${winner} Wins!`;

    if (
      state.mode === "ai" &&
      winner === state.humanSymbol
    ) {
      description.textContent = "Amazing! You defeated the AI!";
    } else if (state.mode === "ai") {
      description.textContent = "The AI wins this round. Try again!";
    } else {
      description.textContent =
        `Congratulations, Player ${winner}!`;
    }
  }

  banner.classList.add("visible");
}

function resetGameResultBanner() {
  const banner = $("#gameResultBanner");
  const title = $("#gameResultTitle");
  const description = $("#gameResultDescription");

  if (!banner || !title || !description) return;

  banner.classList.remove("visible", "winner", "draw");

  title.textContent = "Ready to Play?";

  description.textContent =
    "The match starts when you make your first move.";
}

/* ==========================================
   RESULT MODAL
========================================== */

function showResultModal(winner) {
  const modal = $("#resultModal");

  if (!modal) return;

  const title = $("#resultTitle");
  const message = $("#resultMessage");

  if (title) {
    title.textContent =
      winner === "draw"
        ? "It's a Draw!"
        : `🏆 Player ${winner} Wins!`;
  }

  if (message) {
    if (winner === "draw") {
      message.textContent = "What an exciting match!";
    } else if (
      state.mode === "ai" &&
      winner === state.humanSymbol
    ) {
      message.textContent = "Amazing! You defeated the AI.";
    } else if (state.mode === "ai") {
      message.textContent = "The AI won this round. Try again!";
    } else {
      message.textContent = `Congratulations, Player ${winner}!`;
    }
  }

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeResultModal() {
  const modal = $("#resultModal");

  if (!modal) return;

  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

/* ==========================================
   SCOREBOARD
========================================== */

function updateScoreboard() {
  setText("#aiWins", scores.ai.wins);
  setText("#aiLosses", scores.ai.losses);
  setText("#aiDraws", scores.ai.draws);

  setText("#playerXWins", scores.friend.x);
  setText("#playerOWins", scores.friend.o);
  setText("#friendDraws", scores.friend.draws);

  $("#aiScoreboard")?.classList.toggle(
    "hidden",
    state.mode !== "ai"
  );

  $("#friendScoreboard")?.classList.toggle(
    "hidden",
    state.mode !== "friend"
  );
}

function resetScores() {
  const confirmed = confirm(
    "Reset all scores? Your match history will remain saved."
  );

  if (!confirmed) return;

  scores = {
    ai: { wins: 0, losses: 0, draws: 0 },
    friend: { x: 0, o: 0, draws: 0 }
  };

  saveStorage(STORAGE_KEYS.scores, scores);

  updateScoreboard();

  addCommentary("📊 All scores have been reset.");
}

/* ==========================================
   MATCH HISTORY
========================================== */

function saveMatchHistory(winner) {
  const match = {
    id: Date.now(),

    mode: state.mode,

    difficulty:
      state.mode === "ai"
        ? state.difficulty
        : null,

    humanSymbol:
      state.mode === "ai"
        ? state.humanSymbol
        : null,

    winner,

    moves: state.moveHistory.map((move) => ({
      index: move.index,
      symbol: move.symbol
    })),

    date: new Date().toLocaleString()
  };

  state.lastSavedMatchId = match.id;

  matchHistory.unshift(match);

  matchHistory = matchHistory.slice(0, 50);

  saveStorage(STORAGE_KEYS.history, matchHistory);

  renderHistory();
}

function renderHistory() {
  const container = $("#historyList");

  if (!container) return;

  container.innerHTML = "";

  if (!matchHistory.length) {
    container.innerHTML = `
      <p class="empty-history">
        No matches played yet. Start playing!
      </p>
    `;

    return;
  }

  matchHistory.forEach((match) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "history-item";
    button.dataset.matchId = String(match.id);

    const result =
      match.winner === "draw"
        ? "🤝 Draw"
        : `🏆 Player ${match.winner} Won`;

    const mode =
      match.mode === "ai"
        ? `AI · ${match.difficulty || "Unknown"}`
        : "Two Players";

    const moves = Array.isArray(match.moves)
      ? match.moves.length
      : 0;

    button.innerHTML = `
      <span class="history-result">${escapeHTML(result)}</span>
      <span class="history-info">
        ${escapeHTML(mode)} · ${moves} moves
      </span>
      <span class="history-date">
        ${escapeHTML(match.date)}
      </span>
      <span class="history-open">View Match →</span>
    `;

    container.appendChild(button);
  });
}

function openMatchDetails(matchId) {
  const match = matchHistory.find(
    (item) => String(item.id) === String(matchId)
  );

  if (!match) return;

  const details = $("#matchDetails");
  const title = $("#matchDetailsTitle");
  const info = $("#matchDetailsInfo");
  const movesList = $("#matchMovesList");

  if (!details || !title || !info || !movesList) return;

  title.textContent =
    match.winner === "draw"
      ? "🤝 Match Draw"
      : `🏆 Player ${match.winner} Won!`;

  info.textContent =
    `${match.mode === "ai" ? "AI Match" : "Two Player Match"} · ` +
    `${match.date}`;

  movesList.innerHTML = "";

  if (!Array.isArray(match.moves) || !match.moves.length) {
    const item = document.createElement("li");

    item.textContent =
      "Move details are unavailable for this older match.";

    movesList.appendChild(item);
  } else {
    match.moves.forEach((move, index) => {
      const item = document.createElement("li");

      const row = Math.floor(move.index / 3) + 1;
      const column = (move.index % 3) + 1;

      item.textContent =
        `Move ${index + 1}: Player ${move.symbol} — Row ${row}, Column ${column}`;

      movesList.appendChild(item);
    });
  }

  details.hidden = false;

  $("#historyList").hidden = true;
}

function closeMatchDetails() {
  const details = $("#matchDetails");
  const history = $("#historyList");

  if (details) details.hidden = true;
  if (history) history.hidden = false;
}

function clearHistory() {
  const confirmed = confirm(
    "Delete all match history? Your scores will remain unchanged."
  );

  if (!confirmed) return;

  matchHistory = [];

  saveStorage(STORAGE_KEYS.history, matchHistory);

  renderHistory();
  closeMatchDetails();

  addCommentary("🗂️ Match history has been cleared.");
}

/* ==========================================
   TURN INDICATOR
========================================== */

function updateTurnIndicator() {
  let message;

  if (state.gameOver) {
    message = "Round completed";
  } else if (state.busy) {
    message = "AI is thinking...";
  } else if (state.mode === "ai") {
    message =
      state.currentPlayer === state.humanSymbol
        ? "Your turn"
        : "AI's turn";
  } else {
    message = `Player ${state.currentPlayer}'s turn`;
  }

  setText("#turnIndicator", message);
  setText("#currentTurn", message);
}

function updateRoundHeading() {
  setText("#roundNumber", `Round ${state.round}`);
  setText("#roundHeading", `Round ${state.round}`);
}

/* ==========================================
   THEME CUSTOMIZATION
========================================== */

function applyPreferences() {
  document.documentElement.style.setProperty(
    "--accent",
    state.accent
  );

  document.documentElement.style.setProperty(
    "--bg",
    state.background
  );

  const rgb = hexToRgb(state.accent);

  if (rgb) {
    document.documentElement.style.setProperty(
      "--accent-rgb",
      `${rgb.r}, ${rgb.g}, ${rgb.b}`
    );
  }

  document.body.classList.toggle(
    "light-mode",
    state.lightMode
  );

  const accentInput = $("#accentColor");
  const backgroundInput = $("#backgroundColor");

  if (accentInput) accentInput.value = state.accent;
  if (backgroundInput) backgroundInput.value = state.background;

  const soundButton = $("#soundToggle");

  if (soundButton) {
    soundButton.classList.toggle(
      "active",
      state.soundEnabled
    );

    soundButton.setAttribute(
      "aria-pressed",
      String(state.soundEnabled)
    );
  }
}

function hexToRgb(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;

  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function savePreferences() {
  saveStorage(STORAGE_KEYS.preferences, {
    soundEnabled: state.soundEnabled,
    lightMode: state.lightMode,
    accent: state.accent,
    background: state.background
  });
}

function toggleTheme() {
  state.lightMode = !state.lightMode;

  applyPreferences();
  savePreferences();
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;

  applyPreferences();
  savePreferences();
}

/* ==========================================
   SOUND
========================================== */

function playSound(type) {
  if (!state.soundEnabled) return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    const sounds = {
      move: { frequency: 440, duration: 0.08 },
      win: { frequency: 660, duration: 0.25 },
      draw: { frequency: 330, duration: 0.2 }
    };

    const sound = sounds[type] || sounds.move;

    oscillator.frequency.value = sound.frequency;
    oscillator.type = "sine";

    gain.gain.setValueAtTime(
      0.12,
      audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + sound.duration
    );

    oscillator.start();

    oscillator.stop(
      audioContext.currentTime + sound.duration
    );
  } catch (error) {
    console.warn("Sound playback error:", error);
  }
}

/* ==========================================
   GENERAL HELPERS
========================================== */

function setText(selector, value) {
  const element = $(selector);

  if (element) {
    element.textContent = value;
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

/* ==========================================
   END OF GAME SCRIPT
========================================== */
