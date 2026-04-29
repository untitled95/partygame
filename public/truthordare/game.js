const socket = io('/truthordare');

let currentPlayer = null;
let currentRoom = null;
let isHost = false;
PartySession.setup('truthordare', socket, {
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

function showToast(message, duration = 2200) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
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
  showScreen('lobby');
}

function renderActions(room) {
  const actions = $('game-actions');
  const isCurrentPlayer = room.currentPlayer?.id === currentPlayer?.id;

  if (room.phase === 'choosing' && isCurrentPlayer) {
    actions.innerHTML = `
      <button class="btn btn-primary" data-type="truth">真心话</button>
      <button class="btn btn-danger" data-type="dare">大冒险</button>
      <button class="btn btn-secondary" data-type="random">随机</button>
    `;
  } else if (room.phase === 'choosing') {
    actions.innerHTML = `<div class="info-text">等待 ${escapeHtml(room.currentPlayer?.name || '')} 选择题目。</div>`;
  } else if (room.phase === 'answering') {
    actions.innerHTML = isCurrentPlayer || isHost
      ? '<button class="btn btn-success" data-action="completeTurn">完成，下一位</button>'
      : `<div class="info-text">等待 ${escapeHtml(room.currentPrompt?.playerName || '')} 完成挑战。</div>`;
  } else {
    actions.innerHTML = '';
  }

  if (isHost && room.gameStarted) {
    actions.insertAdjacentHTML('beforeend', '<button class="btn btn-warning" data-action="skipTurn">跳过当前回合</button>');
  }
}

function renderPlayers(room) {
  $('players-grid').innerHTML = room.players.map(player => {
    const isCurrent = player.id === room.currentPlayer?.id;
    return `
      <div class="player-card">
        <div class="player-name">${escapeHtml(player.name)} ${player.id === currentPlayer?.id ? '(你)' : ''}</div>
        <div class="player-meta">
          ${player.isHost ? '<span class="tag warn">房主</span>' : ''}
          ${isCurrent ? '<span class="tag good">当前回合</span>' : ''}
          <span class="tag">${player.completed}次完成</span>
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
  $('current-player-name').textContent = room.currentPlayer?.name || '-';

  if (room.currentPrompt) {
    const typeText = room.currentPrompt.type === 'truth' ? '真心话' : '大冒险';
    $('prompt-text').innerHTML = `<strong>${typeText}</strong>：${escapeHtml(room.currentPrompt.text)}`;
  } else {
    $('prompt-text').textContent = '等待当前玩家选择真心话或大冒险。';
  }

  renderActions(room);
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

$('create-room-btn').addEventListener('click', () => createOrJoinRoom('create'));
$('join-room-btn').addEventListener('click', () => $('join-room-form').classList.toggle('hidden'));
$('confirm-join-btn').addEventListener('click', () => createOrJoinRoom('join'));
$('copy-room-id').addEventListener('click', () => {
  navigator.clipboard.writeText($('room-id-display').textContent);
  showToast('房间号已复制');
});
$('start-game-btn').addEventListener('click', () => socket.emit('startGame'));

$('game-actions').addEventListener('click', (event) => {
  const type = event.target.dataset.type;
  const action = event.target.dataset.action;
  if (type) socket.emit('choosePrompt', { type });
  if (action) socket.emit(action);
});

socket.on('roomCreated', (data) => {
  currentPlayer = data.player;
  renderRoom(data.room);
  showToast('房间创建成功');
});

socket.on('roomJoined', (data) => {
  currentPlayer = data.player;
  renderRoom(data.room);
  showToast('加入房间成功');
});

['playerJoined', 'playerRejoined', 'playerLeft', 'gameStarted', 'promptChosen', 'turnCompleted', 'roomState'].forEach(eventName => {
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
