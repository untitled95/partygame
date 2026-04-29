const boardSize = 16;
const boardEl = document.getElementById('snake-board');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const statusEl = document.getElementById('status');
const messageEl = document.getElementById('message');
const newGameBtn = document.getElementById('new-game-btn');
const pauseBtn = document.getElementById('pause-btn');

const directions = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 }
};
const oppositeDirections = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left'
};

let snake = [];
let food = null;
let direction = 'right';
let nextDirection = 'right';
let score = 0;
let state = 'running';
let timerId = null;
let touchStartX = 0;
let touchStartY = 0;

function getBestScore() {
  return Number(localStorage.getItem('snakeBestScore') || 0);
}

function setBestScore(value) {
  localStorage.setItem('snakeBestScore', String(value));
}

function getSpeed() {
  return Math.max(78, 155 - Math.floor(score / 30) * 10);
}

function keyOf(cell) {
  return `${cell.row},${cell.col}`;
}

function isSameCell(a, b) {
  return a.row === b.row && a.col === b.col;
}

function isInsideBoard(cell) {
  return cell.row >= 0 && cell.row < boardSize && cell.col >= 0 && cell.col < boardSize;
}

function placeFood() {
  const occupied = new Set(snake.map(keyOf));
  const emptyCells = [];

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const cell = { row, col };
      if (!occupied.has(keyOf(cell))) emptyCells.push(cell);
    }
  }

  food = emptyCells[Math.floor(Math.random() * emptyCells.length)] || null;
}

function restartTimer() {
  clearInterval(timerId);
  if (state === 'running') timerId = setInterval(tick, getSpeed());
}

function startGame() {
  const middle = Math.floor(boardSize / 2);
  snake = [
    { row: middle, col: middle + 1 },
    { row: middle, col: middle },
    { row: middle, col: middle - 1 }
  ];
  direction = 'right';
  nextDirection = 'right';
  score = 0;
  state = 'running';
  messageEl.textContent = '不要撞墙，也不要撞到自己。';
  pauseBtn.textContent = '暂停';
  placeFood();
  render();
  restartTimer();
}

function render() {
  const snakeCells = new Set(snake.map(keyOf));
  const head = snake[0];
  const foodKey = food ? keyOf(food) : '';
  let html = '';

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const cell = { row, col };
      const cellKey = keyOf(cell);
      const classes = ['snake-cell'];
      if (snakeCells.has(cellKey)) classes.push('snake');
      if (isSameCell(cell, head)) classes.push('head');
      if (cellKey === foodKey) classes.push('food');
      html += `<div class="${classes.join(' ')}"></div>`;
    }
  }

  boardEl.innerHTML = html;
  scoreEl.textContent = score;
  if (score > getBestScore()) setBestScore(score);
  bestScoreEl.textContent = getBestScore();
  statusEl.textContent = state === 'over' ? '结束' : state === 'paused' ? '暂停' : '进行中';
}

function endGame() {
  state = 'over';
  clearInterval(timerId);
  messageEl.textContent = `游戏结束！本局得分 ${score}。`;
  pauseBtn.textContent = '暂停';
  render();
}

function tick() {
  direction = nextDirection;
  const head = snake[0];
  const move = directions[direction];
  const newHead = { row: head.row + move.row, col: head.col + move.col };
  const ateFood = food && isSameCell(newHead, food);
  const bodyToCheck = ateFood ? snake : snake.slice(0, -1);

  if (!isInsideBoard(newHead) || bodyToCheck.some(cell => isSameCell(cell, newHead))) {
    endGame();
    return;
  }

  snake.unshift(newHead);
  if (ateFood) {
    score += 10;
    placeFood();
    restartTimer();
  } else {
    snake.pop();
  }

  render();
}

function setDirection(next) {
  if (state === 'over' || !directions[next]) return;
  if (oppositeDirections[next] === direction) return;
  nextDirection = next;
}

function togglePause() {
  if (state === 'over') return;

  if (state === 'running') {
    state = 'paused';
    clearInterval(timerId);
    pauseBtn.textContent = '继续';
    messageEl.textContent = '已暂停。';
  } else {
    state = 'running';
    pauseBtn.textContent = '暂停';
    messageEl.textContent = '继续前进！';
    restartTimer();
  }

  render();
}

document.addEventListener('keydown', (event) => {
  const keyMap = {
    ArrowUp: 'up',
    w: 'up',
    W: 'up',
    ArrowDown: 'down',
    s: 'down',
    S: 'down',
    ArrowLeft: 'left',
    a: 'left',
    A: 'left',
    ArrowRight: 'right',
    d: 'right',
    D: 'right'
  };
  const next = keyMap[event.key];
  if (!next) return;
  event.preventDefault();
  setDirection(next);
});

document.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('click', () => setDirection(button.dataset.direction));
});

boardEl.addEventListener('touchstart', (event) => {
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}, { passive: true });

boardEl.addEventListener('touchend', (event) => {
  const dx = event.changedTouches[0].clientX - touchStartX;
  const dy = event.changedTouches[0].clientY - touchStartY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  setDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

newGameBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
startGame();
