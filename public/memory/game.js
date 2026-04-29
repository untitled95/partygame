const emojis = ['🍎', '🍌', '🍇', '🍓', '🍉', '🍒', '🥝', '🍍'];
const boardEl = document.getElementById('memory-board');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const matchesEl = document.getElementById('matches');
const messageEl = document.getElementById('message');
const newGameBtn = document.getElementById('new-game-btn');

let cards = [];
let firstCard = null;
let secondCard = null;
let locked = false;
let moves = 0;
let matches = 0;
let startTime = null;
let timerId = null;

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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
  stopTimer();
  startTime = null;
  timerEl.textContent = '0s';
  messageEl.textContent = '点击两张牌，配对成功后会保留。';
  render();
}

function render() {
  movesEl.textContent = moves;
  matchesEl.textContent = `${matches}/${emojis.length}`;
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
  if (locked || card.revealed || card.matched) return;
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

    if (matches === emojis.length) {
      stopTimer();
      messageEl.textContent = `完成！共 ${moves} 步，用时 ${timerEl.textContent}。`;
    }
    render();
    return;
  }

  messageEl.textContent = '不一样，再试试。';
  setTimeout(() => {
    firstCard.revealed = false;
    secondCard.revealed = false;
    firstCard = null;
    secondCard = null;
    locked = false;
    render();
  }, 800);
}

boardEl.addEventListener('click', (event) => {
  const id = Number(event.target.dataset.id);
  if (!Number.isInteger(id)) return;
  const card = cards.find(item => item.id === id);
  if (card) revealCard(card);
});

newGameBtn.addEventListener('click', startGame);
startGame();
