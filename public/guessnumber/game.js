const socket = io('/guessnumber');

let currentPlayer = null;
let currentRoom = null;
let isHost = false;
PartySession.setup('guessnumber', socket, {
  hasActiveSession: () => Boolean(currentPlayer && currentRoom),
  onRejoined: (data) => {
    currentPlayer = data.player;
    renderRoom(data.room);
    showToast('已恢复房间');
  }
});

const $ = (id) => document.getElementById(id);
const screens = {
  home: $('home-screen'),
  lobby: $('lobby-screen'),
  game: $('game-screen')
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[name].classList.add('active');
}

function showToast(message, duration = 2400) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

function validNumber(value) {
  return /^\d{4}$/.test(value) && new Set(value).size === 4;
}

function updateHostFlag(room) {
  const me = room.players.find(player => player.id === currentPlayer?.id);
  isHost = Boolean(me?.isHost);
}

function updatePlayersList(players) {
  $('player-count').textContent = players.length;
  $('players-list').innerHTML = players.map(player => `
    <li>
      <span>${escapeHtml(player.name)} ${player.id === currentPlayer?.id ? '(你)' : ''}</span>
      ${player.isHost ? '<span class="host-badge">房主</span>' : ''}
    </li>
  `).join('');
}

function enterLobby(room) {
  updateHostFlag(room);
  $('room-id-display').textContent = room.id;
  updatePlayersList(room.players);
  $('host-controls').classList.toggle('hidden', !isHost);
  $('waiting-message').classList.toggle('hidden', isHost);
  $('start-game-btn').disabled = room.players.length !== 2;
  showScreen('lobby');
}

function getMe(room) {
  return room.players.find(player => player.id === currentPlayer?.id);
}

function phaseTitle(room) {
  if (room.phase === 'setSecret') return '设置秘密数字';
  if (room.phase === 'playing') return room.currentPlayer?.id === currentPlayer?.id ? '轮到你猜' : `等待 ${room.currentPlayer?.name || '对手'} 猜`;
  if (room.phase === 'ended') return room.winner ? `${room.winner.name} 获胜！` : '游戏结束';
  return '等待中';
}

function phaseDesc(room) {
  const me = getMe(room);
  if (room.phase === 'setSecret') {
    return me?.ready ? '你已设置，等待对手确认秘密数字。' : '请输入一个4位不重复数字，对手看不到。';
  }
  if (room.phase === 'playing') {
    return `第 ${room.turnNumber} 手，目标是猜出对方的秘密数字。`;
  }
  if (room.phase === 'ended') {
    const secrets = room.players.map(player => `${player.name}: ${player.secret}`).join('，');
    return `本局秘密数字：${secrets}`;
  }
  return '等待房主开始游戏。';
}

function renderPanels(room) {
  const me = getMe(room);
  const isMyTurn = room.currentPlayer?.id === currentPlayer?.id;

  $('secret-panel').classList.toggle('hidden', room.phase !== 'setSecret' || Boolean(me?.ready));
  $('guess-panel').classList.toggle('hidden', room.phase !== 'playing' || !isMyTurn);
  $('guess-btn').disabled = room.phase !== 'playing' || !isMyTurn;

  const actions = $('game-actions');
  actions.innerHTML = '';
  if (room.phase === 'ended' && isHost) {
    actions.innerHTML = '<button class="btn btn-primary" data-action="restartGame">再来一局</button>';
  }
}

function renderPlayers(room) {
  $('players-grid').innerHTML = room.players.map(player => {
    const isCurrent = player.id === room.currentPlayer?.id;
    const secretTag = player.secret
      ? `<span class="tag ${room.phase === 'ended' ? 'warn' : 'good'}">${room.phase === 'ended' ? player.secret : '已设置'}</span>`
      : '<span class="tag warn">未设置</span>';

    return `
      <div class="player-card">
        <div class="player-name">${escapeHtml(player.name)} ${player.id === currentPlayer?.id ? '(你)' : ''}</div>
        <div class="player-meta">
          ${player.isHost ? '<span class="tag warn">房主</span>' : ''}
          ${isCurrent && room.phase === 'playing' ? '<span class="tag good">当前回合</span>' : ''}
          <span class="tag">${player.score}分</span>
          ${secretTag}
        </div>
      </div>
    `;
  }).join('');
}

function renderHistory(room) {
  $('history-list').innerHTML = room.history.length
    ? room.history.map(item => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>暂无记录</li>';
}

function renderGame(room) {
  updateHostFlag(room);
  $('game-room-id').textContent = room.id;
  $('status-title').textContent = phaseTitle(room);
  $('status-desc').textContent = phaseDesc(room);
  renderPanels(room);
  renderPlayers(room);
  renderHistory(room);
  showScreen('game');
}

function renderRoom(room) {
  currentRoom = room;
  if (room.phase === 'lobby') {
    enterLobby(room);
  } else {
    renderGame(room);
  }
}

function createOrJoinRoom(action) {
  const name = $('player-name').value.trim();
  if (!name) {
    showToast('请输入昵称');
    return;
  }
  if (action === 'create') {
    socket.emit('createRoom', name);
    return;
  }

  const roomId = $('room-code').value.trim().toUpperCase();
  if (!roomId) {
    showToast('请输入房间号');
    return;
  }
  socket.emit('joinRoom', { roomId, playerName: name });
}

function submitSecret() {
  const secret = $('secret-input').value.trim();
  if (!validNumber(secret)) {
    showToast('请输入4位不重复数字');
    return;
  }
  socket.emit('setSecret', { secret });
  $('secret-input').value = '';
}

function submitGuess() {
  const guess = $('guess-input').value.trim();
  if (!validNumber(guess)) {
    showToast('请输入4位不重复数字');
    return;
  }
  socket.emit('makeGuess', { guess });
  $('guess-input').value = '';
}

$('create-room-btn').addEventListener('click', () => createOrJoinRoom('create'));
$('join-room-btn').addEventListener('click', () => $('join-room-form').classList.toggle('hidden'));
$('confirm-join-btn').addEventListener('click', () => createOrJoinRoom('join'));
$('copy-room-id').addEventListener('click', () => {
  navigator.clipboard.writeText($('room-id-display').textContent);
  showToast('房间号已复制');
});
$('start-game-btn').addEventListener('click', () => socket.emit('startGame'));
$('set-secret-btn').addEventListener('click', submitSecret);
$('guess-btn').addEventListener('click', submitGuess);
$('secret-input').addEventListener('keypress', (event) => {
  if (event.key === 'Enter') submitSecret();
});
$('guess-input').addEventListener('keypress', (event) => {
  if (event.key === 'Enter') submitGuess();
});
$('game-actions').addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (action) socket.emit(action);
});

socket.on('roomCreated', (data) => {
  currentPlayer = data.player;
  renderRoom(data.room);
  showToast('房间创建成功，邀请朋友加入');
});

socket.on('roomJoined', (data) => {
  currentPlayer = data.player;
  renderRoom(data.room);
  showToast('加入房间成功');
});

['playerJoined', 'playerRejoined', 'playerLeft', 'gameStarted', 'secretSet', 'secretsReady', 'guessMade', 'gameEnded', 'roomState'].forEach(eventName => {
  socket.on(eventName, (data) => {
    if (data.player?.name) {
      const actionText = eventName === 'playerLeft' ? '离开了房间' : eventName === 'playerRejoined' ? '回到了房间' : '加入了房间';
      showToast(`${data.player.name} ${actionText}`);
    }
    renderRoom(data.room);
  });
});

socket.on('error', (data) => showToast(data.message));
socket.on('disconnect', () => showToast('连接断开，请刷新页面'));
