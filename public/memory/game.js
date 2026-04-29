const emojiPool = ['🍎', '🍌', '🍇', '🍓', '🍉', '🍒', '🥝', '🍍', '🍋', '🍑', '🥥', '🥑'];
const levels = [
  { name: '入门', pairs: 4, columns: 4 },
  { name: '简单', pairs: 6, columns: 4 },
  { name: '标准', pairs: 8, columns: 4 },
  { name: '困难', pairs: 10, columns: 4 },
  { name: '大师', pairs: 12, columns: 4 }
];

const boardEl = document.getElementById('memory-board');
const levelEl = document.getElementById('level');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const matchesEl = document.getElementById('matches');
const messageEl = document.getElementById('message');
const newGameBtn = document.getElementById('new-game-btn');
const nextLevelBtn = document.getElementById('next-level-btn');

let cards = [];
let firstCard = null;
let secondCard = null;
let locked = false;
let moves = 0;
let matches = 0;
let startTime = null;
let timerId = null;
let currentLevelIndex = 0;
let levelComplete = false;
let mismatchTimerId = null;

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getCurrentLevel() {
  return levels[currentLevelIndex];
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

function startLevel(levelIndex = currentLevelIndex) {
  currentLevelIndex = Math.min(Math.max(levelIndex, 0), levels.length - 1);
  const level = getCurrentLevel();
  const emojis = emojiPool.slice(0, level.pairs);

  clearTimeout(mismatchTimerId);
  mismatchTimerId = null;
  cards = shuffle([...emojis, ...emojis]).map((emoji, index) => ({
    id: index,
    emoji,
    revealed: false,
    matched: false
  }));
  firstCard = null;
  secondCard = null;
  locked = false;
  moves = 0;
  matches = 0;
  levelComplete = false;
  stopTimer();
  startTime = null;
  timerEl.textContent = '0s';
  nextLevelBtn.disabled = true;
  nextLevelBtn.textContent = currentLevelIndex === levels.length - 1 ? '最后一关' : '下一关';
  messageEl.textContent = `第 ${currentLevelIndex + 1} 关：${level.name}，需要配对 ${level.pairs} 对牌。`;
  render();
}

function render() {
  const level = getCurrentLevel();
  boardEl.style.setProperty('--memory-columns', level.columns);
  levelEl.textContent = `${currentLevelIndex + 1}/${levels.length}`;
  movesEl.textContent = moves;
  matchesEl.textContent = `${matches}/${level.pairs}`;
  boardEl.innerHTML = cards.map(card => {
    const visible = card.revealed || card.matched;
    return `
      <button class="memory-card ${visible ? 'revealed' : ''} ${card.matched ? 'matched' : ''}" data-id="${card.id}">
        ${visible ? card.emoji : '❔'}
      </button>
    `;
  }).join('');
}

function revealCard(card) {
  if (locked || levelComplete || card.revealed || card.matched) return;
  startTimer();

  card.revealed = true;
  if (!firstCard) {
    firstCard = card;
    render();
    return;
  }

  secondCard = card;
  moves++;
  locked = true;
  render();

  if (firstCard.emoji === secondCard.emoji) {
    firstCard.matched = true;
    secondCard.matched = true;
    matches++;
    messageEl.textContent = '配对成功！';
    firstCard = null;
    secondCard = null;
    locked = false;

    if (matches === getCurrentLevel().pairs) {
      levelComplete = true;
      stopTimer();
      if (currentLevelIndex === levels.length - 1) {
        messageEl.textContent = `全部通关！最后一关用了 ${moves} 步，用时 ${timerEl.textContent}。`;
        nextLevelBtn.textContent = '已通关';
      } else {
        messageEl.textContent = `本关完成！共 ${moves} 步，用时 ${timerEl.textContent}，可以进入下一关。`;
        nextLevelBtn.disabled = false;
      }
    }
    render();
    return;
  }

  messageEl.textContent = '不一样，再试试。';
  const previousFirstCard = firstCard;
  const previousSecondCard = secondCard;
  mismatchTimerId = setTimeout(() => {
    previousFirstCard.revealed = false;
    previousSecondCard.revealed = false;
    firstCard = null;
    secondCard = null;
    locked = false;
    mismatchTimerId = null;
    render();
  }, 800);
}

boardEl.addEventListener('click', (event) => {
  const id = Number(event.target.dataset.id);
  if (!Number.isInteger(id)) return;
  const card = cards.find(item => item.id === id);
  if (card) revealCard(card);
});

newGameBtn.addEventListener('click', () => startLevel(currentLevelIndex));
nextLevelBtn.addEventListener('click', () => {
  if (!levelComplete || currentLevelIndex >= levels.length - 1) return;
  startLevel(currentLevelIndex + 1);
});
startLevel();
