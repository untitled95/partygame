const boardWidth = 4;
const boardHeight = 5;
const boardEl = document.getElementById('huarongdao-board');
const movesEl = document.getElementById('moves');
const bestMovesEl = document.getElementById('best-moves');
const statusEl = document.getElementById('status');
const messageEl = document.getElementById('message');
const resetBtn = document.getElementById('reset-btn');
const undoBtn = document.getElementById('undo-btn');

const initialPieces = [
  { id: 'zhangfei', name: '张飞', type: 'general', row: 0, col: 0, width: 1, height: 2 },
  { id: 'cao', name: '曹操', type: 'cao', row: 0, col: 1, width: 2, height: 2 },
  { id: 'zhaoyun', name: '赵云', type: 'general', row: 0, col: 3, width: 1, height: 2 },
  { id: 'machao', name: '马超', type: 'general', row: 2, col: 0, width: 1, height: 2 },
  { id: 'guanyu', name: '关羽', type: 'horizontal', row: 2, col: 1, width: 2, height: 1 },
  { id: 'huangzhong', name: '黄忠', type: 'general', row: 2, col: 3, width: 1, height: 2 },
  { id: 'soldier1', name: '兵', type: 'soldier', row: 3, col: 1, width: 1, height: 1 },
  { id: 'soldier2', name: '兵', type: 'soldier', row: 3, col: 2, width: 1, height: 1 },
  { id: 'soldier3', name: '兵', type: 'soldier', row: 4, col: 0, width: 1, height: 1 },
  { id: 'soldier4', name: '兵', type: 'soldier', row: 4, col: 3, width: 1, height: 1 }
];

const directions = {
  up: { row: -1, col: 0, label: '上' },
  down: { row: 1, col: 0, label: '下' },
  left: { row: 0, col: -1, label: '左' },
  right: { row: 0, col: 1, label: '右' }
};

let pieces = [];
let selectedId = 'cao';
let moves = 0;
let won = false;
let history = [];
let pointerStart = null;
let suppressNextClick = false;

function clonePieces(source) {
  return source.map(piece => ({ ...piece }));
}

function getBestMoves() {
  const value = Number(localStorage.getItem('huarongdaoBestMoves') || 0);
  return value > 0 ? value : null;
}

function setBestMoves(value) {
  localStorage.setItem('huarongdaoBestMoves', String(value));
}

function getPieceCells(piece, offset = { row: 0, col: 0 }) {
  const cells = [];
  for (let row = 0; row < piece.height; row++) {
    for (let col = 0; col < piece.width; col++) {
      cells.push({
        row: piece.row + row + offset.row,
        col: piece.col + col + offset.col
      });
    }
  }
  return cells;
}

function cellKey(cell) {
  return `${cell.row},${cell.col}`;
}

function isInsideBoard(cell) {
  return cell.row >= 0 && cell.row < boardHeight && cell.col >= 0 && cell.col < boardWidth;
}

function buildOccupiedMap(ignoreId) {
  const occupied = new Set();
  pieces.forEach(piece => {
    if (piece.id === ignoreId) return;
    getPieceCells(piece).forEach(cell => occupied.add(cellKey(cell)));
  });
  return occupied;
}

function canMove(piece, direction) {
  const offset = directions[direction];
  if (!piece || !offset) return false;

  const occupied = buildOccupiedMap(piece.id);
  return getPieceCells(piece, offset).every(cell => isInsideBoard(cell) && !occupied.has(cellKey(cell)));
}

function updateBestMoves() {
  const bestMoves = getBestMoves();
  if (!bestMoves || moves < bestMoves) setBestMoves(moves);
}

function checkWin() {
  const cao = pieces.find(piece => piece.id === 'cao');
  if (!cao || cao.row !== 3 || cao.col !== 1) return;

  won = true;
  updateBestMoves();
  statusEl.textContent = '胜利';
  messageEl.textContent = `曹操成功突围！共用了 ${moves} 步。`;
}

function render() {
  const bestMoves = getBestMoves();
  movesEl.textContent = moves;
  bestMovesEl.textContent = bestMoves ? `${bestMoves}` : '-';
  statusEl.textContent = won ? '胜利' : '进行中';
  undoBtn.disabled = history.length === 0 || won;

  boardEl.innerHTML = `
    <div class="huarongdao-exit">出口</div>
    ${pieces.map(piece => {
      const left = piece.col * 25;
      const top = piece.row * 20;
      const width = piece.width * 25;
      const height = piece.height * 20;
      const classes = ['huarongdao-piece', piece.type];
      if (piece.id === selectedId) classes.push('selected');

      return `
        <button
          class="${classes.join(' ')}"
          data-id="${piece.id}"
          style="left: calc(${left}% + 4px); top: calc(${top}% + 4px); width: calc(${width}% - 8px); height: calc(${height}% - 8px);"
          aria-label="${piece.name}"
        >${piece.name}</button>
      `;
    }).join('')}
  `;
}

function selectPiece(id) {
  const piece = pieces.find(item => item.id === id);
  if (!piece) return;
  selectedId = id;
  messageEl.textContent = `已选中 ${piece.name}。`;
  render();
}

function moveSelected(direction) {
  if (won) return;
  const piece = pieces.find(item => item.id === selectedId);
  if (!piece) {
    messageEl.textContent = '请先选择一个棋子。';
    return;
  }

  if (!canMove(piece, direction)) {
    messageEl.textContent = `${piece.name} 不能向${directions[direction].label}移动。`;
    return;
  }

  history.push({
    pieces: clonePieces(pieces),
    selectedId,
    moves
  });

  piece.row += directions[direction].row;
  piece.col += directions[direction].col;
  moves++;
  messageEl.textContent = `${piece.name} 向${directions[direction].label}移动。`;
  checkWin();
  render();
}

function resetGame() {
  pieces = clonePieces(initialPieces);
  selectedId = 'cao';
  moves = 0;
  won = false;
  history = [];
  messageEl.textContent = '先点选一个棋子，再用方向按钮、键盘方向键或滑动棋子移动。';
  render();
}

function undoMove() {
  if (history.length === 0 || won) return;
  const previous = history.pop();
  pieces = clonePieces(previous.pieces);
  selectedId = previous.selectedId;
  moves = previous.moves;
  won = false;
  messageEl.textContent = '已撤销一步。';
  render();
}

function getDirectionFromDelta(dx, dy) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

boardEl.addEventListener('click', (event) => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }

  const pieceButton = event.target.closest('[data-id]');
  if (pieceButton) selectPiece(pieceButton.dataset.id);
});

boardEl.addEventListener('pointerdown', (event) => {
  const pieceButton = event.target.closest('[data-id]');
  if (!pieceButton) return;
  selectedId = pieceButton.dataset.id;
  pointerStart = {
    id: selectedId,
    x: event.clientX,
    y: event.clientY
  };
});

boardEl.addEventListener('pointerup', (event) => {
  if (!pointerStart) return;
  const direction = getDirectionFromDelta(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  const id = pointerStart.id;
  pointerStart = null;
  selectedId = id;

  if (direction) {
    suppressNextClick = true;
    moveSelected(direction);
  } else {
    selectPiece(id);
  }
});

boardEl.addEventListener('pointercancel', () => {
  pointerStart = null;
});

document.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('click', () => moveSelected(button.dataset.direction));
});

document.addEventListener('keydown', (event) => {
  const keyMap = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    W: 'up',
    s: 'down',
    S: 'down',
    a: 'left',
    A: 'left',
    d: 'right',
    D: 'right'
  };
  const direction = keyMap[event.key];
  if (!direction) return;
  event.preventDefault();
  moveSelected(direction);
});

resetBtn.addEventListener('click', resetGame);
undoBtn.addEventListener('click', undoMove);
resetGame();
