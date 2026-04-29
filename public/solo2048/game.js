const size = 4;
const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const statusEl = document.getElementById('status');
const newGameBtn = document.getElementById('new-game-btn');

let board = [];
let score = 0;
let gameOver = false;
let touchStartX = 0;
let touchStartY = 0;

function getBestScore() {
  return Number(localStorage.getItem('solo2048Best') || 0);
}

function setBestScore(value) {
  localStorage.setItem('solo2048Best', String(value));
}

function createEmptyBoard() {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function emptyCells() {
  const cells = [];
  board.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value === 0) cells.push([rowIndex, colIndex]);
    });
  });
  return cells;
}

function addRandomTile() {
  const cells = emptyCells();
  if (cells.length === 0) return;
  const [row, col] = cells[Math.floor(Math.random() * cells.length)];
  board[row][col] = Math.random() < 0.9 ? 2 : 4;
}

function startGame() {
  board = createEmptyBoard();
  score = 0;
  gameOver = false;
  addRandomTile();
  addRandomTile();
  render();
}

function render() {
  boardEl.innerHTML = board.flat().map(value => (
    `<div class="tile-2048 ${value ? `v${Math.min(value, 8192)}` : ''}">${value || ''}</div>`
  )).join('');

  scoreEl.textContent = score;
  if (score > getBestScore()) setBestScore(score);
  bestScoreEl.textContent = getBestScore();
  statusEl.textContent = gameOver ? '结束' : board.flat().includes(2048) ? '达成!' : '进行中';
}

function mergeLine(line) {
  const values = line.filter(Boolean);
  const merged = [];
  let gained = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      const value = values[i] * 2;
      merged.push(value);
      gained += value;
      i++;
    } else {
      merged.push(values[i]);
    }
  }

  while (merged.length < size) merged.push(0);
  return { line: merged, gained };
}

function getColumn(colIndex) {
  return board.map(row => row[colIndex]);
}

function setColumn(colIndex, values) {
  values.forEach((value, rowIndex) => {
    board[rowIndex][colIndex] = value;
  });
}

function move(direction) {
  if (gameOver) return;

  const before = JSON.stringify(board);
  let gained = 0;

  if (direction === 'left' || direction === 'right') {
    board = board.map(row => {
      const source = direction === 'right' ? [...row].reverse() : row;
      const result = mergeLine(source);
      gained += result.gained;
      return direction === 'right' ? result.line.reverse() : result.line;
    });
  } else {
    for (let col = 0; col < size; col++) {
      const source = direction === 'down' ? getColumn(col).reverse() : getColumn(col);
      const result = mergeLine(source);
      gained += result.gained;
      setColumn(col, direction === 'down' ? result.line.reverse() : result.line);
    }
  }

  if (JSON.stringify(board) === before) return;

  score += gained;
  addRandomTile();
  gameOver = !canMove();
  render();
}

function canMove() {
  if (emptyCells().length > 0) return true;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const value = board[row][col];
      if (board[row][col + 1] === value || board[row + 1]?.[col] === value) return true;
    }
  }

  return false;
}

document.addEventListener('keydown', (event) => {
  const directions = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down'
  };
  if (!directions[event.key]) return;
  event.preventDefault();
  move(directions[event.key]);
});

boardEl.addEventListener('touchstart', (event) => {
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}, { passive: true });

boardEl.addEventListener('touchend', (event) => {
  const dx = event.changedTouches[0].clientX - touchStartX;
  const dy = event.changedTouches[0].clientY - touchStartY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

newGameBtn.addEventListener('click', startGame);
startGame();
