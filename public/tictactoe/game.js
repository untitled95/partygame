const boardEl = document.getElementById('tictactoe-board');
const playerScoreEl = document.getElementById('player-score');
const computerScoreEl = document.getElementById('computer-score');
const drawScoreEl = document.getElementById('draw-score');
const messageEl = document.getElementById('message');
const newRoundBtn = document.getElementById('new-round-btn');
const resetScoreBtn = document.getElementById('reset-score-btn');

const playerMark = 'X';
const computerMark = 'O';
const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

let board = Array(9).fill('');
let locked = false;
let roundOver = false;
let score = loadScore();

function loadScore() {
  const saved = localStorage.getItem('tictactoeScore');
  if (!saved) return { player: 0, computer: 0, draw: 0 };

  try {
    const parsed = JSON.parse(saved);
    return {
      player: Number(parsed.player) || 0,
      computer: Number(parsed.computer) || 0,
      draw: Number(parsed.draw) || 0
    };
  } catch {
    return { player: 0, computer: 0, draw: 0 };
  }
}

function saveScore() {
  localStorage.setItem('tictactoeScore', JSON.stringify(score));
}

function render() {
  playerScoreEl.textContent = score.player;
  computerScoreEl.textContent = score.computer;
  drawScoreEl.textContent = score.draw;
  boardEl.innerHTML = board.map((mark, index) => (
    `<button class="ttt-cell ${mark.toLowerCase()}" data-index="${index}" aria-label="第${index + 1}格">${mark}</button>`
  )).join('');
}

function getWinner(currentBoard = board) {
  for (const line of winningLines) {
    const [a, b, c] = line;
    if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
      return currentBoard[a];
    }
  }

  return currentBoard.every(Boolean) ? 'draw' : null;
}

function finishRound(result) {
  roundOver = true;
  locked = false;

  if (result === playerMark) {
    score.player++;
    messageEl.textContent = '你赢了！';
  } else if (result === computerMark) {
    score.computer++;
    messageEl.textContent = '电脑赢了，再来一局。';
  } else {
    score.draw++;
    messageEl.textContent = '平局！';
  }

  saveScore();
  render();
}

function checkAfterMove() {
  const result = getWinner();
  if (result) finishRound(result);
  return Boolean(result);
}

function findWinningMove(mark) {
  for (const index of getEmptyIndexes()) {
    const testBoard = [...board];
    testBoard[index] = mark;
    if (getWinner(testBoard) === mark) return index;
  }
  return null;
}

function getEmptyIndexes() {
  return board.map((mark, index) => (mark ? null : index)).filter(index => index !== null);
}

function chooseComputerMove() {
  const winningMove = findWinningMove(computerMark);
  if (winningMove !== null) return winningMove;

  const blockingMove = findWinningMove(playerMark);
  if (blockingMove !== null) return blockingMove;

  if (!board[4]) return 4;

  const emptyCorners = [0, 2, 6, 8].filter(index => !board[index]);
  if (emptyCorners.length > 0) return emptyCorners[Math.floor(Math.random() * emptyCorners.length)];

  const emptyIndexes = getEmptyIndexes();
  return emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
}

function computerMove() {
  if (roundOver) return;
  const move = chooseComputerMove();
  if (move === undefined) return;

  board[move] = computerMark;
  locked = false;
  if (!checkAfterMove()) {
    messageEl.textContent = '轮到你了。';
    render();
  }
}

function playerMove(index) {
  if (locked || roundOver || board[index]) return;

  board[index] = playerMark;
  render();
  if (checkAfterMove()) return;

  locked = true;
  messageEl.textContent = '电脑思考中...';
  setTimeout(computerMove, 320);
}

function startRound() {
  board = Array(9).fill('');
  locked = false;
  roundOver = false;
  messageEl.textContent = '轮到你了，点击任意空格落子。';
  render();
}

function resetScore() {
  score = { player: 0, computer: 0, draw: 0 };
  saveScore();
  render();
}

boardEl.addEventListener('click', (event) => {
  const index = Number(event.target.dataset.index);
  if (Number.isInteger(index)) playerMove(index);
});

newRoundBtn.addEventListener('click', startRound);
resetScoreBtn.addEventListener('click', resetScore);
startRound();
