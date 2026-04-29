const difficulties = {
  beginner: { label: '入门', size: 8, mines: 8, cellSize: 42 },
  classic: { label: '标准', size: 9, mines: 10, cellSize: 40 },
  advanced: { label: '进阶', size: 12, mines: 24, cellSize: 35 },
  expert: { label: '专家', size: 16, mines: 40, cellSize: 30 }
};

const boardEl = document.getElementById('minesweeper-board');
const difficultySelectEl = document.getElementById('difficulty-select');
const difficultyLabelEl = document.getElementById('difficulty-label');
const remainingMinesEl = document.getElementById('remaining-mines');
const timerEl = document.getElementById('timer');
const statusEl = document.getElementById('status');
const messageEl = document.getElementById('message');
const newGameBtn = document.getElementById('new-game-btn');
const flagModeBtn = document.getElementById('flag-mode-btn');

let cells = [];
let firstMove = true;
let gameOver = false;
let flagMode = false;
let startTime = null;
let timerId = null;
let currentDifficultyKey = localStorage.getItem('minesweeperDifficulty') || 'classic';
let size = difficulties[currentDifficultyKey]?.size || difficulties.classic.size;
let mineCount = difficulties[currentDifficultyKey]?.mines || difficulties.classic.mines;

function getCurrentDifficulty() {
  return difficulties[currentDifficultyKey] || difficulties.classic;
}

function applyDifficulty(key) {
  currentDifficultyKey = difficulties[key] ? key : 'classic';
  const difficulty = getCurrentDifficulty();
  size = difficulty.size;
  mineCount = difficulty.mines;
  localStorage.setItem('minesweeperDifficulty', currentDifficultyKey);
  difficultySelectEl.value = currentDifficultyKey;
  difficultyLabelEl.textContent = difficulty.label;
  boardEl.style.setProperty('--minesweeper-size', size);
  boardEl.style.setProperty('--mine-board-max', `${Math.min(520, size * difficulty.cellSize)}px`);
  boardEl.style.setProperty('--mine-cell-gap', size >= 14 ? '2px' : size >= 12 ? '3px' : '4px');
  boardEl.style.setProperty('--mine-cell-radius', size >= 14 ? '6px' : size >= 12 ? '7px' : '9px');
  boardEl.style.setProperty('--mine-cell-font-size', size >= 14 ? '0.72rem' : size >= 12 ? '0.92rem' : '1.18rem');
}

function createCells() {
  cells = Array.from({ length: size * size }, (_, index) => ({
    index,
    row: Math.floor(index / size),
    col: index % size,
    mine: false,
    revealed: false,
    flagged: false,
    count: 0
  }));
}

function getNeighbors(index) {
  const cell = cells[index];
  return cells.filter(candidate => (
    Math.abs(candidate.row - cell.row) <= 1 &&
    Math.abs(candidate.col - cell.col) <= 1 &&
    candidate.index !== index
  ));
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function placeMines(safeIndex) {
  const safeIndexes = new Set([safeIndex, ...getNeighbors(safeIndex).map(cell => cell.index)]);
  const candidates = shuffle(cells.filter(cell => !safeIndexes.has(cell.index)));

  candidates.slice(0, mineCount).forEach(cell => {
    cell.mine = true;
  });

  cells.forEach(cell => {
    cell.count = getNeighbors(cell.index).filter(neighbor => neighbor.mine).length;
  });
}

function startTimer() {
  if (timerId) return;
  startTime = Date.now();
  timerId = setInterval(() => {
    timerEl.textContent = `${Math.floor((Date.now() - startTime) / 1000)}s`;
  }, 250);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function startGame() {
  applyDifficulty(currentDifficultyKey);
  createCells();
  firstMove = true;
  gameOver = false;
  flagMode = false;
  stopTimer();
  startTime = null;
  timerEl.textContent = '0s';
  statusEl.textContent = '准备';
  messageEl.textContent = `${getCurrentDifficulty().label}难度：${size} x ${size}，${mineCount} 雷。电脑右键插旗，手机可开启插旗模式。`;
  flagModeBtn.textContent = '插旗模式：关';
  render();
}

function getFlagCount() {
  return cells.filter(cell => cell.flagged).length;
}

function render() {
  remainingMinesEl.textContent = mineCount - getFlagCount();
  boardEl.innerHTML = cells.map(cell => {
    const classes = ['mine-cell'];
    let label = '';

    if (cell.revealed) {
      classes.push('revealed');
      if (cell.mine) {
        classes.push('mine');
        label = '💣';
      } else if (cell.count > 0) {
        classes.push(`n${cell.count}`);
        label = cell.count;
      }
    } else if (cell.flagged) {
      classes.push('flagged');
      label = '🚩';
    }

    return `<button class="${classes.join(' ')}" data-index="${cell.index}" aria-label="第${cell.row + 1}行第${cell.col + 1}列">${label}</button>`;
  }).join('');
}

function revealEmptyArea(startIndex) {
  const queue = [cells[startIndex]];
  const visited = new Set();

  while (queue.length > 0) {
    const cell = queue.shift();
    if (visited.has(cell.index) || cell.flagged) continue;
    visited.add(cell.index);
    cell.revealed = true;

    if (cell.count === 0) {
      getNeighbors(cell.index).forEach(neighbor => {
        if (!neighbor.revealed && !neighbor.mine) queue.push(neighbor);
      });
    }
  }
}

function revealAllMines() {
  cells.forEach(cell => {
    if (cell.mine) cell.revealed = true;
  });
}

function checkWin() {
  const revealedSafeCells = cells.filter(cell => cell.revealed && !cell.mine).length;
  if (revealedSafeCells !== size * size - mineCount) return false;

  gameOver = true;
  stopTimer();
  statusEl.textContent = '胜利';
  messageEl.textContent = `${getCurrentDifficulty().label}难度完成！用时 ${timerEl.textContent}。`;
  return true;
}

function revealCell(index) {
  if (gameOver) return;
  const cell = cells[index];
  if (!cell || cell.revealed || cell.flagged) return;

  if (firstMove) {
    placeMines(index);
    firstMove = false;
    statusEl.textContent = '进行中';
    startTimer();
  }

  if (cell.mine) {
    cell.revealed = true;
    revealAllMines();
    gameOver = true;
    stopTimer();
    statusEl.textContent = '失败';
    messageEl.textContent = '踩到地雷了，再来一局吧。';
    render();
    return;
  }

  revealEmptyArea(index);
  checkWin();
  render();
}

function toggleFlag(index) {
  if (gameOver) return;
  const cell = cells[index];
  if (!cell || cell.revealed) return;
  if (!cell.flagged && getFlagCount() >= mineCount) {
    messageEl.textContent = '旗子数量已经等于地雷数了。';
    return;
  }

  cell.flagged = !cell.flagged;
  messageEl.textContent = cell.flagged ? '已插旗。' : '已取消旗子。';
  render();
}

boardEl.addEventListener('click', (event) => {
  const index = Number(event.target.dataset.index);
  if (!Number.isInteger(index)) return;
  if (flagMode) {
    toggleFlag(index);
  } else {
    revealCell(index);
  }
});

boardEl.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const index = Number(event.target.dataset.index);
  if (Number.isInteger(index)) toggleFlag(index);
});

flagModeBtn.addEventListener('click', () => {
  flagMode = !flagMode;
  flagModeBtn.textContent = flagMode ? '插旗模式：开' : '插旗模式：关';
  messageEl.textContent = flagMode ? '点击格子会插旗，再点按钮可返回翻开模式。' : '点击格子会翻开。';
});

difficultySelectEl.addEventListener('change', () => {
  applyDifficulty(difficultySelectEl.value);
  startGame();
});

newGameBtn.addEventListener('click', startGame);
startGame();
