const zone = document.getElementById('reaction-zone');
const zoneTitle = document.getElementById('zone-title');
const zoneDesc = document.getElementById('zone-desc');
const startBtn = document.getElementById('start-btn');
const lastTimeEl = document.getElementById('last-time');
const bestTimeEl = document.getElementById('best-time');
const attemptsEl = document.getElementById('attempts');

let state = 'idle';
let readyAt = 0;
let timeoutId = null;
let attempts = 0;

function getBestTime() {
  const value = localStorage.getItem('reactionBest');
  return value ? Number(value) : null;
}

function setBestTime(value) {
  localStorage.setItem('reactionBest', String(value));
}

function updateBestDisplay() {
  const best = getBestTime();
  bestTimeEl.textContent = best ? `${best}ms` : '-';
}

function setZone(nextState, title, desc) {
  state = nextState;
  zone.className = `reaction-zone ${nextState}`;
  zoneTitle.textContent = title;
  zoneDesc.textContent = desc;
}

function startTest() {
  clearTimeout(timeoutId);
  startBtn.disabled = true;
  setZone('waiting', '等一下...', '不要提前点，等变绿！');

  const delay = 1200 + Math.floor(Math.random() * 3300);
  timeoutId = setTimeout(() => {
    readyAt = performance.now();
    setZone('ready', '点！', '现在点击这里');
  }, delay);
}

function finishReaction() {
  const elapsed = Math.round(performance.now() - readyAt);
  attempts++;
  attemptsEl.textContent = attempts;
  lastTimeEl.textContent = `${elapsed}ms`;

  const best = getBestTime();
  if (!best || elapsed < best) {
    setBestTime(elapsed);
    updateBestDisplay();
    setZone('done', `${elapsed}ms`, '新纪录！点击开始按钮再测一次。');
  } else {
    setZone('done', `${elapsed}ms`, '不错，再试一次挑战最佳成绩。');
  }
  startBtn.disabled = false;
}

function falseStart() {
  clearTimeout(timeoutId);
  lastTimeEl.textContent = '抢跑';
  setZone('done', '太早了！', '还没变绿就点了，重新开始吧。');
  startBtn.disabled = false;
}

zone.addEventListener('click', () => {
  if (state === 'waiting') {
    falseStart();
  } else if (state === 'ready') {
    finishReaction();
  }
});

startBtn.addEventListener('click', startTest);
updateBestDisplay();
