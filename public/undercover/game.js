const socket = io('/undercover');

let currentPlayer = null;
let currentRoom = null;
let isHost = false;
PartySession.setup('undercover', socket, {
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

function phaseText(phase) {
  return {
    discussion: '描述讨论',
    voting: '投票中',
    ended: '游戏结束'
  }[phase] || '等待中';
}

function winnerText(winner) {
  if (winner === 'civilian') return '平民阵营获胜！';
  if (winner === 'undercover') return '卧底阵营获胜！';
  return '';
}

function renderActions(room) {
  const actions = $('game-actions');
  actions.innerHTML = '';

  if (isHost && room.phase === 'discussion') {
    actions.innerHTML = '<button class="btn btn-warning" data-action="startVoting">发起投票</button>';
  } else if (isHost && room.phase === 'ended') {
    actions.innerHTML = '<button class="btn btn-primary" data-action="restartGame">再来一局</button>';
  } else if (room.phase === 'voting') {
    actions.innerHTML = '<div class="info-text">请选择你怀疑的卧底，所有存活玩家投票后自动结算。</div>';
  }
}

function renderPlayers(room) {
  const me = room.players.find(player => player.id === currentPlayer?.id);
  const canVote = room.phase === 'voting' && me?.alive && !me.hasVoted;

  $('players-grid').innerHTML = room.players.map(player => {
    const tags = [
      player.isHost ? '<span class="tag warn">房主</span>' : '',
      player.alive ? '<span class="tag good">存活</span>' : '<span class="tag bad">出局</span>',
      player.hasVoted ? '<span class="tag">已投票</span>' : '',
      player.votesReceived ? `<span class="tag warn">${player.votesReceived}票</span>` : '',
      player.role ? `<span class="tag ${player.role === 'undercover' ? 'bad' : 'good'}">${player.role === 'undercover' ? '卧底' : '平民'}</span>` : ''
    ].join('');
    const voteButton = canVote && player.alive && player.id !== currentPlayer.id
      ? `<button class="btn btn-small btn-danger" data-vote="${player.id}">投TA</button>`
      : '';

    return `
      <div class="player-card ${player.alive ? '' : 'dead'}">
        <div class="player-name">${escapeHtml(player.name)} ${player.id === currentPlayer?.id ? '(你)' : ''}</div>
        <div class="player-meta">${tags}</div>
        ${voteButton}
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
  $('my-word').textContent = room.myWord || '-';
  $('phase-text').textContent = phaseText(room.phase);
  $('round-number').textContent = room.roundNumber || 1;
  $('alive-count').textContent = room.aliveCount || 0;

  const winner = winnerText(room.winner);
  $('winner-text').classList.toggle('hidden', !winner);
  $('winner-text').textContent = winner;
  $('role-note').textContent = room.phase === 'ended'
    ? '身份已公开，可以复盘刚才的描述和投票。'
    : '不要直接说出词语，轮流描述后投票。';

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
  const action = event.target.dataset.action;
  if (!action) return;
  socket.emit(action);
});

$('players-grid').addEventListener('click', (event) => {
  const targetPlayerId = event.target.dataset.vote;
  if (!targetPlayerId) return;
  socket.emit('votePlayer', { targetPlayerId });
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

['playerJoined', 'playerRejoined', 'playerLeft', 'gameStarted', 'votingStarted', 'voteResolved', 'roomState'].forEach(eventName => {
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
