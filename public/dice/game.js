const socket = io('/dice');

let currentPlayer = null;
let currentRoom = null;
let isHost = false;
PartySession.setup('dice', socket, {
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

function renderDice(values = []) {
  return `<div class="dice-list">${values.map(value => `<span class="die">${value}</span>`).join('')}</div>`;
}

function renderActions(room) {
  const me = room.players.find(player => player.id === currentPlayer?.id);
  const actions = $('game-actions');
  actions.innerHTML = '';

  if (room.phase === 'rolling' && me && !me.hasRolled) {
    actions.innerHTML = '<button class="btn btn-primary" data-action="rollDice">摇骰子</button>';
  } else if (room.phase === 'rolling') {
    actions.innerHTML = '<div class="info-text">你已摇骰，等待其他玩家。</div>';
  } else if (room.phase === 'roundResult' && isHost) {
    actions.innerHTML = '<button class="btn btn-success" data-action="nextRound">下一轮</button>';
  } else if (room.phase === 'ended' && isHost) {
    actions.innerHTML = '<button class="btn btn-primary" data-action="restartGame">再来一局</button>';
  }
}

function renderPlayers(room) {
  $('players-grid').innerHTML = [...room.players]
    .sort((a, b) => b.score - a.score)
    .map(player => {
      const roll = player.lastRoll;
      return `
        <div class="player-card">
          <div class="player-name">${escapeHtml(player.name)} ${player.id === currentPlayer?.id ? '(你)' : ''}</div>
          <div class="player-meta">
            ${player.isHost ? '<span class="tag warn">房主</span>' : ''}
            <span class="tag good">${player.score}分</span>
            ${player.hasRolled ? '<span class="tag">已摇</span>' : '<span class="tag warn">等待</span>'}
          </div>
          ${roll ? `${renderDice(roll.values)}<div class="muted">合计 ${roll.total} 点</div>` : '<div class="muted">本轮未摇</div>'}
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
  $('round-title').textContent = room.phase === 'ended'
    ? '游戏结束'
    : `第 ${room.roundNumber}/${room.totalRounds} 轮`;

  if (room.phase === 'rolling') {
    $('round-desc').textContent = `每人摇 ${room.diceCount} 颗骰子，最高点数得分。`;
  } else if (room.phase === 'roundResult') {
    $('round-desc').textContent = `本轮赢家：${room.roundWinners.map(winner => winner.name).join('、')}`;
  } else if (room.phase === 'ended') {
    const topScore = Math.max(...room.players.map(player => player.score));
    const winners = room.players.filter(player => player.score === topScore).map(player => player.name);
    $('round-desc').textContent = `最终赢家：${winners.join('、')}，${topScore}分。`;
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
$('start-game-btn').addEventListener('click', () => {
  socket.emit('startGame', {
    totalRounds: $('total-rounds').value,
    diceCount: $('dice-count').value
  });
});

$('game-actions').addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  socket.emit(action);
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

['playerJoined', 'playerRejoined', 'playerLeft', 'gameStarted', 'rollMade', 'roundResolved', 'newRound', 'roomState'].forEach(eventName => {
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
