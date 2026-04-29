const socket = io('/werewolf');

let currentPlayer = null;
let currentRoom = null;
let isHost = false;
PartySession.setup('werewolf', socket, {
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

const roleHelp = {
  wolf: '夜晚选择一名非狼人玩家袭击；白天隐藏身份参与投票。',
  seer: '夜晚可以查验一名玩家是否为狼人。',
  witch: '夜晚可以使用一次解药救人，或使用一次毒药毒人。',
  villager: '没有夜晚技能，白天通过发言和投票找出狼人。'
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

function showToast(message, duration = 2800) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

function updateHostFlag(room) {
  const me = room.players.find(player => player.id === currentPlayer?.id);
  isHost = Boolean(me?.isHost);
}

function isAlive(room) {
  return Boolean(room.players.find(player => player.id === currentPlayer?.id)?.alive);
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
    night: '夜晚行动',
    day: '白天讨论',
    voting: '白天投票',
    ended: '游戏结束'
  }[phase] || '等待中';
}

function winnerText(winner) {
  if (winner === 'good') return '好人阵营获胜！';
  if (winner === 'wolf') return '狼人阵营获胜！';
  return '';
}

function actionButton(text, action, targetPlayerId, style = 'btn-secondary') {
  return `<button class="btn btn-small ${style}" data-action="${action}" data-target="${targetPlayerId}">${text}</button>`;
}

function renderNightActions(room, actions) {
  const alivePlayers = room.players.filter(player => player.alive);
  const wolfIds = new Set((room.wolfTeammates || []).map(player => player.id));

  if (!isAlive(room)) {
    actions.push('<div class="info-text">你已出局，等待本局结束。</div>');
    return;
  }

  if (room.myRole === 'wolf') {
    actions.push('<div class="info-text">狼人请选择袭击目标。</div>');
    alivePlayers
      .filter(player => !wolfIds.has(player.id))
      .forEach(player => actions.push(actionButton(`袭击 ${escapeHtml(player.name)}`, 'wolfKill', player.id, 'btn-danger')));
  }

  if (room.myRole === 'seer') {
    actions.push('<div class="info-text">预言家请选择查验目标。</div>');
    alivePlayers
      .filter(player => player.id !== currentPlayer.id)
      .forEach(player => actions.push(actionButton(`查验 ${escapeHtml(player.name)}`, 'seerCheck', player.id, 'btn-secondary')));
  }

  if (room.myRole === 'witch' && room.witch) {
    if (room.witch.nightVictim && !room.witch.saveUsed) {
      actions.push(actionButton(`救 ${escapeHtml(room.witch.nightVictim.name)}`, 'witchSave', room.witch.nightVictim.id, 'btn-success'));
    }
    if (!room.witch.poisonUsed) {
      actions.push('<div class="info-text">女巫可以选择一名玩家使用毒药。</div>');
      alivePlayers
        .filter(player => player.id !== currentPlayer.id)
        .forEach(player => actions.push(actionButton(`毒 ${escapeHtml(player.name)}`, 'witchPoison', player.id, 'btn-danger')));
    }
  }

  if (isHost) {
    actions.push('<button class="btn btn-warning" data-action="finishNight">结束夜晚</button>');
  }
}

function renderActions(room) {
  const actions = [];

  if (room.phase === 'night') {
    renderNightActions(room, actions);
  } else if (room.phase === 'day') {
    actions.push('<div class="info-text">白天讨论阶段，讨论结束后由房主发起投票。</div>');
    if (isHost) actions.push('<button class="btn btn-warning" data-action="startVoting">发起投票</button>');
  } else if (room.phase === 'voting') {
    const me = room.players.find(player => player.id === currentPlayer?.id);
    if (me?.alive && !me.hasVoted) {
      room.players
        .filter(player => player.alive && player.id !== currentPlayer.id)
        .forEach(player => actions.push(actionButton(`投 ${escapeHtml(player.name)}`, 'votePlayer', player.id, 'btn-danger')));
    } else {
      actions.push('<div class="info-text">等待所有存活玩家投票。</div>');
    }
  } else if (room.phase === 'ended' && isHost) {
    actions.push('<button class="btn btn-primary" data-action="restartGame">再来一局</button>');
  }

  $('game-actions').innerHTML = actions.join('');
}

function renderPlayers(room) {
  $('players-grid').innerHTML = room.players.map(player => {
    const roleTag = player.roleName ? `<span class="tag ${player.role === 'wolf' ? 'bad' : 'good'}">${player.roleName}</span>` : '';
    return `
      <div class="player-card ${player.alive ? '' : 'dead'}">
        <div class="player-name">${escapeHtml(player.name)} ${player.id === currentPlayer?.id ? '(你)' : ''}</div>
        <div class="player-meta">
          ${player.isHost ? '<span class="tag warn">房主</span>' : ''}
          ${player.alive ? '<span class="tag good">存活</span>' : '<span class="tag bad">出局</span>'}
          ${player.hasVoted ? '<span class="tag">已投票</span>' : ''}
          ${player.votesReceived ? `<span class="tag warn">${player.votesReceived}票</span>` : ''}
          ${roleTag}
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
  $('my-role').textContent = room.myRoleName || '-';
  $('role-help').textContent = roleHelp[room.myRole] || '根据身份在夜晚行动，白天一起投票。';
  $('phase-text').textContent = phaseText(room.phase);
  $('day-number').textContent = room.dayNumber || 1;

  const winner = winnerText(room.winner);
  $('winner-text').classList.toggle('hidden', !winner);
  $('winner-text').textContent = winner;

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
  const targetPlayerId = event.target.dataset.target;
  if (!action) return;

  if (['wolfKill', 'seerCheck', 'witchSave', 'witchPoison', 'votePlayer'].includes(action)) {
    socket.emit(action, { targetPlayerId });
  } else {
    socket.emit(action);
  }
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

['playerJoined', 'playerRejoined', 'playerLeft', 'gameStarted', 'nightResolved', 'votingStarted', 'voteResolved', 'roomState'].forEach(eventName => {
  socket.on(eventName, (data) => {
    if (data.player?.name) {
      const actionText = eventName === 'playerLeft' ? '离开了房间' : eventName === 'playerRejoined' ? '回到了房间' : '加入了房间';
      showToast(`${data.player.name} ${actionText}`);
    }
    renderRoom(data.room);
  });
});

socket.on('seerResult', (data) => {
  showToast(`${data.target.name} ${data.isWolf ? '是狼人' : '不是狼人'}`, 5000);
});

socket.on('error', (data) => showToast(data.message));
socket.on('disconnect', () => showToast('连接断开，请刷新页面'));
