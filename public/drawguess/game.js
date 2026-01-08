// 连接服务器 (使用 /drawguess 命名空间)
const socket = io('/drawguess');

// 当前玩家和房间信息
let currentPlayer = null;
let currentRoom = null;
let isHost = false;
let isDrawer = false;
let currentWord = null;
let hasGuessedCorrect = false;

// 画板相关
let canvas, ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = '#000000';
let brushSize = 5;
let isEraser = false;  // 橡皮擦模式

// DOM 元素
const screens = {
  home: document.getElementById('home-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen')
};

// 首页元素
const playerNameInput = document.getElementById('player-name');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinRoomForm = document.getElementById('join-room-form');
const roomCodeInput = document.getElementById('room-code');
const confirmJoinBtn = document.getElementById('confirm-join-btn');

// 等待室元素
const roomIdDisplay = document.getElementById('room-id-display');
const copyRoomIdBtn = document.getElementById('copy-room-id');
const playerCountSpan = document.getElementById('player-count');
const playersList = document.getElementById('players-list');
const hostControls = document.getElementById('host-controls');
const startGameBtn = document.getElementById('start-game-btn');
const waitingMessage = document.getElementById('waiting-message');
const roundTimeSelect = document.getElementById('round-time');
const totalRoundsSelect = document.getElementById('total-rounds');

// 游戏元素
const currentRoundSpan = document.getElementById('current-round');
const totalRoundsDisplay = document.getElementById('total-rounds-display');
const timerDisplay = document.getElementById('timer');
const drawerNameSpan = document.getElementById('drawer-name');
const wordHintSpan = document.getElementById('word-hint');
const drawTools = document.getElementById('draw-tools');
const guessInput = document.getElementById('guess-input');
const sendGuessBtn = document.getElementById('send-guess-btn');
const chatMessages = document.getElementById('chat-messages');
const roundResult = document.getElementById('round-result');
const showScoresBtn = document.getElementById('show-scores-btn');
const scoresModal = document.getElementById('scores-modal');
const scoresList = document.getElementById('scores-list');
const clearCanvasBtn = document.getElementById('clear-canvas-btn');
const eraserBtn = document.getElementById('eraser-btn');
const gameOverModal = document.getElementById('game-over-modal');

// 结束界面
const finalRankings = document.getElementById('final-rankings');
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');

// Toast
const toast = document.getElementById('toast');

// 切换屏幕
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
}

// 显示 Toast
function showToast(message, duration = 2000) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// 初始化画板
function initCanvas() {
  canvas = document.getElementById('draw-canvas');
  ctx = canvas.getContext('2d');
  
  // 计算画布大小：根据屏幕剩余空间自适应
  const screenHeight = window.innerHeight;
  const headerHeight = 50;  // 顶部信息栏
  const wordAreaHeight = 30; // 词语提示
  const toolsHeight = isDrawer ? 70 : 0;  // 工具栏（画手才有）
  const guessAreaHeight = 120; // 输入区域
  const padding = 30;
  
  const availableHeight = screenHeight - headerHeight - wordAreaHeight - toolsHeight - guessAreaHeight - padding;
  const containerWidth = canvas.parentElement.offsetWidth - 16;
  
  // 取较小值，确保画布是正方形且不超出屏幕
  const size = Math.min(containerWidth, availableHeight, 320);
  canvas.width = size;
  canvas.height = size;
  
  // 设置白色背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 画笔默认设置
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = currentColor;
  ctx.lineWidth = brushSize;
  
  // 绑定事件
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  // 触摸事件
  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', stopDrawing);
}

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  if (e.touches) {
    return {
      x: (e.touches[0].clientX - rect.left) * scaleX,
      y: (e.touches[0].clientY - rect.top) * scaleY
    };
  }
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function startDrawing(e) {
  if (!isDrawer) return;
  isDrawing = true;
  const coords = getCanvasCoords(e);
  lastX = coords.x;
  lastY = coords.y;
}

function draw(e) {
  if (!isDrawing || !isDrawer) return;
  e.preventDefault();
  
  const coords = getCanvasCoords(e);
  const drawColor = isEraser ? '#ffffff' : currentColor;
  
  ctx.strokeStyle = drawColor;
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(coords.x, coords.y);
  ctx.stroke();
  
  // 发送绘画数据
  socket.emit('drawing', {
    fromX: lastX / canvas.width,
    fromY: lastY / canvas.height,
    toX: coords.x / canvas.width,
    toY: coords.y / canvas.height,
    color: drawColor,
    size: brushSize
  });
  
  lastX = coords.x;
  lastY = coords.y;
}

function stopDrawing() {
  isDrawing = false;
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  startDrawing(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  if (!isDrawing) return;
  const coords = getCanvasCoords(e);
  const drawColor = isEraser ? '#ffffff' : currentColor;
  
  ctx.strokeStyle = drawColor;
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(coords.x, coords.y);
  ctx.stroke();
  
  socket.emit('drawing', {
    fromX: lastX / canvas.width,
    fromY: lastY / canvas.height,
    toX: coords.x / canvas.width,
    toY: coords.y / canvas.height,
    color: drawColor,
    size: brushSize
  });
  
  lastX = coords.x;
  lastY = coords.y;
}

function clearCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = isEraser ? '#ffffff' : currentColor;
}

// 颜色选择
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // 退出橡皮擦模式
    isEraser = false;
    eraserBtn?.classList.remove('active');
    
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.dataset.color;
    ctx.strokeStyle = currentColor;
  });
});

// 画笔大小
document.getElementById('brush-size').addEventListener('input', (e) => {
  brushSize = parseInt(e.target.value);
  ctx.lineWidth = brushSize;
});

// 橡皮擦
eraserBtn?.addEventListener('click', () => {
  isEraser = !isEraser;
  eraserBtn.classList.toggle('active', isEraser);
  if (isEraser) {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  } else {
    // 恢复当前颜色
    document.querySelector(`.color-btn[data-color="${currentColor}"]`)?.classList.add('active');
  }
});

// 清空画布
clearCanvasBtn?.addEventListener('click', () => {
  clearCanvas();
  socket.emit('clearCanvas');
});

// 更新玩家列表
function updatePlayersList(players) {
  playersList.innerHTML = '';
  players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = player.name;
    if (player.isHost) li.classList.add('host');
    playersList.appendChild(li);
  });
  playerCountSpan.textContent = players.length;
}

// 更新积分列表
function updateScoresList(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  scoresList.innerHTML = sorted.map(p => `
    <div class="score-row">
      <span>${p.name}</span>
      <span>${p.score}分</span>
    </div>
  `).join('');
}

// 添加聊天消息
function addChatMessage(name, message, type = 'normal') {
  const div = document.createElement('div');
  div.className = `chat-message ${type}`;
  if (type === 'system') {
    div.textContent = message;
  } else {
    div.innerHTML = `<span class="name">${name}:</span>${message}`;
  }
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 生成词语提示（下划线）
function generateHint(word) {
  return word.split('').map(() => '_').join(' ');
}

// ==================== 事件绑定 ====================

// 创建房间
createRoomBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    showToast('请输入昵称');
    return;
  }
  socket.emit('createRoom', name);
});

// 加入房间
joinRoomBtn.addEventListener('click', () => {
  joinRoomForm.classList.toggle('hidden');
});

confirmJoinBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  const roomId = roomCodeInput.value.trim().toUpperCase();
  if (!name) {
    showToast('请输入昵称');
    return;
  }
  if (!roomId) {
    showToast('请输入房间号');
    return;
  }
  socket.emit('joinRoom', { roomId, playerName: name });
});

// 复制房间号
copyRoomIdBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(roomIdDisplay.textContent);
  showToast('房间号已复制');
});

// 开始游戏
startGameBtn.addEventListener('click', () => {
  socket.emit('startGame');
});

// 发送猜测
function sendGuess() {
  const guess = guessInput.value.trim();
  if (!guess) return;
  socket.emit('guess', guess);
  guessInput.value = '';
}

sendGuessBtn.addEventListener('click', sendGuess);
guessInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendGuess();
});

// 积分弹窗
showScoresBtn.addEventListener('click', () => {
  scoresModal.classList.remove('hidden');
});

document.querySelector('.close-modal').addEventListener('click', () => {
  scoresModal.classList.add('hidden');
});

// ==================== Socket 事件 ====================

// 房间创建成功
socket.on('roomCreated', (data) => {
  currentPlayer = data.player;
  currentRoom = data.room;
  isHost = true;
  
  roomIdDisplay.textContent = data.roomId;
  updatePlayersList(data.room.players);
  hostControls.classList.remove('hidden');
  waitingMessage.classList.add('hidden');
  
  showScreen('lobby');
});

// 加入房间成功
socket.on('roomJoined', (data) => {
  currentPlayer = data.player;
  currentRoom = data.room;
  isHost = data.player.isHost;
  
  roomIdDisplay.textContent = data.roomId;
  updatePlayersList(data.room.players);
  
  if (isHost) {
    hostControls.classList.remove('hidden');
    waitingMessage.classList.add('hidden');
  }
  
  showScreen('lobby');
});

// 玩家加入
socket.on('playerJoined', (data) => {
  currentRoom = data.room;
  updatePlayersList(data.room.players);
  showToast(`${data.player.name} 加入了房间`);
});

// 玩家离开
socket.on('playerLeft', (data) => {
  currentRoom = data.room;
  updatePlayersList(data.room.players);
  showToast(`${data.player.name} 离开了房间`);
});

// 游戏开始
socket.on('gameStarted', (data) => {
  currentRoom = data.room;
  totalRoundsDisplay.textContent = data.room.maxRounds;
  initCanvas();
  updateRoundUI(data.room);
  showScreen('game');
});

// 新回合开始
socket.on('newRound', (data) => {
  currentRoom = data.room;
  hasGuessedCorrect = false;
  clearCanvas();
  chatMessages.innerHTML = '';
  roundResult.classList.add('hidden');
  updateRoundUI(data.room);
});

// 更新回合UI
function updateRoundUI(room) {
  currentRoundSpan.textContent = room.roundNumber;
  timerDisplay.textContent = room.timeLeft;
  
  const isCurrentDrawer = room.currentDrawer && room.currentDrawer.id === currentPlayer.id;
  isDrawer = isCurrentDrawer;
  
  if (isCurrentDrawer) {
    drawerNameSpan.textContent = '你来画！';
    wordHintSpan.textContent = room.currentWord || '';
    currentWord = room.currentWord;
    drawTools.classList.remove('hidden');
    guessInput.disabled = true;
    sendGuessBtn.disabled = true;
    addChatMessage('', '你来画！题目是: ' + room.currentWord, 'system');
  } else {
    drawerNameSpan.textContent = `${room.currentDrawer?.name || ''} 正在画`;
    wordHintSpan.textContent = room.wordHint || '';
    drawTools.classList.add('hidden');
    guessInput.disabled = false;
    sendGuessBtn.disabled = false;
    addChatMessage('', `${room.currentDrawer?.name || ''} 开始画画，快来猜吧！`, 'system');
  }
  
  updateScoresList(room.players);
}

// 倒计时更新
socket.on('timeUpdate', (data) => {
  timerDisplay.textContent = data.timeLeft;
  if (data.timeLeft <= 10) {
    timerDisplay.classList.add('urgent');
  } else {
    timerDisplay.classList.remove('urgent');
  }
});

// 收到绘画数据
socket.on('drawing', (data) => {
  if (isDrawer) return;
  
  ctx.strokeStyle = data.color;
  ctx.lineWidth = data.size;
  ctx.beginPath();
  ctx.moveTo(data.fromX * canvas.width, data.fromY * canvas.height);
  ctx.lineTo(data.toX * canvas.width, data.toY * canvas.height);
  ctx.stroke();
});

// 清空画布
socket.on('clearCanvas', () => {
  clearCanvas();
});

// 收到聊天消息
socket.on('chatMessage', (data) => {
  addChatMessage(data.player.name, data.message, data.isSystem ? 'system' : 'normal');
});

// 猜对了
socket.on('correctGuess', (data) => {
  addChatMessage('', `🎉 ${data.player.name} 猜对了！(+${data.score}分)`, 'correct');
  currentRoom = data.room;
  updateScoresList(data.room.players);
  
  if (data.player.id === currentPlayer.id) {
    hasGuessedCorrect = true;
    guessInput.disabled = true;
    sendGuessBtn.disabled = true;
    showToast('🎉 恭喜你猜对了！');
  }
});

// 时间到
socket.on('timeUp', (data) => {
  roundResult.classList.remove('hidden');
  document.getElementById('result-title').textContent = '时间到！';
  document.querySelector('#result-word span').textContent = data.word;
  
  updateScoresList(data.room.players);
  
  guessInput.disabled = true;
  sendGuessBtn.disabled = true;
});

// 游戏结束
socket.on('gameEnded', (data) => {
  // 隐藏回合结束弹窗
  roundResult.classList.add('hidden');
  
  const sorted = data.rankings;
  
  finalRankings.innerHTML = sorted.map((p, i) => `
    <div class="rank-item">
      <span class="rank-position">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
      <span class="rank-name">${p.name}</span>
      <span class="rank-score">${p.score}分</span>
    </div>
  `).join('');
  
  // 显示游戏结束弹窗
  gameOverModal.classList.remove('hidden');
});

// 返回大厅
backToLobbyBtn.addEventListener('click', () => {
  location.reload();
});

// 错误处理
socket.on('error', (data) => {
  showToast(data.message);
});

socket.on('disconnect', () => {
  showToast('连接断开，请刷新页面');
});

// 阻止双击缩放
document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });
