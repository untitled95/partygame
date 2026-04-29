// 连接服务器
const socket = io();

// 当前玩家和房间信息
let currentPlayer = null;
let currentRoom = null;
let isHost = false;
let myHand = [];

// DOM 元素
const screens = {
  home: document.getElementById('home-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  preview: document.getElementById('preview-screen')
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

// 游戏元素
const gameRoomId = document.getElementById('game-room-id');
const roundNumber = document.getElementById('round-number');
const deckRemaining = document.getElementById('deck-remaining');
const kingsCount = document.getElementById('kings-count');
const cardDisplay = document.getElementById('card-display');
const cardRule = document.getElementById('card-rule');
const ruleName = document.getElementById('rule-name');
const ruleDescription = document.getElementById('rule-description');
const currentTurn = document.getElementById('current-turn');
const lastDraw = document.getElementById('last-draw');
const actionMessage = document.getElementById('action-message');
const drawCardBtn = document.getElementById('draw-card-btn');
const gamePlayersList = document.getElementById('game-players-list');
const hostGameControls = document.getElementById('host-game-controls');
const shuffleBtn = document.getElementById('shuffle-btn');
const handCards = document.getElementById('hand-cards');

// 特殊状态元素
const missHolders = document.getElementById('miss-holders');
const crazyHolders = document.getElementById('crazy-holders');
const kRuleDisplay = document.getElementById('k-rule');

// K规则输入
const kRuleInput = document.getElementById('k-rule-input');
const kRuleText = document.getElementById('k-rule-text');
const setKRuleBtn = document.getElementById('set-k-rule-btn');

// 弹窗
const rulesModal = document.getElementById('rules-modal');
const rulesBtn = document.getElementById('rules-btn');
const closeModal = document.querySelector('.close-modal');
const playerSelectModal = document.getElementById('player-select-modal');
const playerSelectTitle = document.getElementById('player-select-title');
const playerSelectList = document.getElementById('player-select-list');
const closePlayerSelect = document.querySelector('.close-player-select');

// Toast
const toast = document.getElementById('toast');

// 自定义弹窗元素
const confirmModal = document.getElementById('confirm-modal');
const confirmIcon = document.getElementById('confirm-icon');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

const alertModal = document.getElementById('alert-modal');
const alertIcon = document.getElementById('alert-icon');
const alertTitle = document.getElementById('alert-title');
const alertMessage = document.getElementById('alert-message');
const alertOkBtn = document.getElementById('alert-ok-btn');

const optionsModal = document.getElementById('options-modal');
const optionsIcon = document.getElementById('options-icon');
const optionsTitle = document.getElementById('options-title');
const optionsMessage = document.getElementById('options-message');
const optionsButtons = document.getElementById('options-buttons');

// 当前选择操作
let currentSelectAction = null;
let confirmCallback = null;
let alertCallback = null;

// 切换屏幕
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
}

// 显示 Toast 消息
function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

function restoreRoomSession(data) {
  currentPlayer = data.player;
  currentRoom = data.room;
  isHost = data.player.isHost;

  roomIdDisplay.textContent = data.roomId;
  updatePlayersList(data.room.players);
  hostControls.classList.toggle('hidden', !isHost);
  waitingMessage.classList.toggle('hidden', isHost);

  if (data.room.gameStarted) {
    enterGameScreen(data.room);
  } else {
    showScreen('lobby');
  }

  showToast('已恢复房间');
}

PartySession.setup('drinkinggame', socket, {
  hasActiveSession: () => Boolean(currentPlayer && currentRoom),
  onRejoined: restoreRoomSession
});

// ==================== 自定义弹窗函数 ====================

// 显示确认弹窗
function showConfirm(options) {
  const { title = '确认', message, icon = '❓', onConfirm, onCancel, confirmText = '确定', cancelText = '取消' } = options;
  
  confirmIcon.textContent = icon;
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmOkBtn.textContent = confirmText;
  confirmCancelBtn.textContent = cancelText;
  
  confirmCallback = { onConfirm, onCancel };
  confirmModal.classList.remove('hidden');
}

// 显示提示弹窗
function showAlert(options) {
  const { title = '提示', message, icon = '💡', onClose, buttonText = '知道了' } = options;
  
  alertIcon.textContent = icon;
  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertOkBtn.textContent = buttonText;
  
  alertCallback = onClose;
  alertModal.classList.remove('hidden');
}

// 显示选项弹窗
function showOptions(options) {
  const { title = '选择', message, icon = '🎯', items = [], showCancel = true, cancelText = '取消' } = options;
  
  optionsIcon.textContent = icon;
  optionsTitle.textContent = title;
  optionsMessage.textContent = message;
  optionsButtons.innerHTML = '';
  
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-option';
    btn.textContent = item.text;
    btn.addEventListener('click', () => {
      optionsModal.classList.add('hidden');
      if (item.onClick) item.onClick();
    });
    optionsButtons.appendChild(btn);
  });
  
  if (showCancel) {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-cancel';
    cancelBtn.textContent = cancelText;
    cancelBtn.addEventListener('click', () => {
      optionsModal.classList.add('hidden');
    });
    optionsButtons.appendChild(cancelBtn);
  }
  
  optionsModal.classList.remove('hidden');
}

// 确认弹窗按钮事件
confirmOkBtn.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  if (confirmCallback?.onConfirm) confirmCallback.onConfirm();
  confirmCallback = null;
});

confirmCancelBtn.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  if (confirmCallback?.onCancel) confirmCallback.onCancel();
  confirmCallback = null;
});

// 提示弹窗按钮事件
alertOkBtn.addEventListener('click', () => {
  alertModal.classList.add('hidden');
  if (alertCallback) alertCallback();
  alertCallback = null;
});

// 更新玩家列表（等待室）
function updatePlayersList(players) {
  playersList.innerHTML = '';
  playerCountSpan.textContent = players.length;
  
  players.forEach(player => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${player.name} ${player.id === currentPlayer.id ? '(你)' : ''}</span>
      ${player.isHost ? '<span class="host-badge">房主</span>' : ''}
    `;
    playersList.appendChild(li);
  });
}

// 更新游戏中的玩家列表
function updateGamePlayersList(players, currentPlayerId) {
  gamePlayersList.innerHTML = '';
  
  players.forEach(player => {
    const chip = document.createElement('div');
    chip.className = 'player-chip';
    if (player.id === currentPlayerId) {
      chip.classList.add('current');
    }
    if (player.id === currentPlayer.id) {
      chip.classList.add('is-me');
    }
    
    // 显示手牌数量
    let handIndicator = '';
    if (player.handCount > 0) {
      handIndicator = `<span class="hand-indicator">🃏${player.handCount}</span>`;
    }
    
    chip.innerHTML = `${player.name} ${handIndicator}`;
    gamePlayersList.appendChild(chip);
  });
}

// 更新我的手牌显示
function updateMyHand(room) {
  handCards.innerHTML = '';
  
  // 找到自己的玩家数据
  const me = room.players.find(p => p.id === currentPlayer.id);
  if (!me || me.handCards.length === 0) {
    handCards.innerHTML = '<span class="hand-card-empty">暂无手牌</span>';
    return;
  }
  
  myHand = me.handCards;
  
  me.handCards.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = 'hand-card';
    cardEl.dataset.cardId = card.id;
    cardEl.dataset.cardValue = card.value;
    
    // 可以主动发动的牌（5-照相机，6-摸鼻子）
    if (card.value === '5' || card.value === '6') {
      cardEl.classList.add('activatable');
    }
    
    const icon = card.rule?.icon || '🃏';
    const name = card.rule?.name || card.value;
    
    let extraInfo = '';
    if (card.value === '8' && card.toiletRoundsLeft) {
      extraInfo = `(${card.toiletRoundsLeft}轮)`;
    }
    
    cardEl.innerHTML = `
      <span class="card-icon">${icon}</span>
      <span class="card-name">${name}${extraInfo}</span>
    `;
    
    // 点击手牌
    cardEl.addEventListener('click', () => handleHandCardClick(card));
    
    handCards.appendChild(cardEl);
  });
}

// 处理手牌点击
function handleHandCardClick(card) {
  switch (card.value) {
    case '5': // 照相机
      showConfirm({
        title: '发动照相机',
        message: '确定要发动"照相机"吗？发动后所有动的人喝酒！',
        icon: '📷',
        confirmText: '发动',
        onConfirm: () => {
          socket.emit('activateCard', { cardId: card.id });
        }
      });
      break;
    case '6': // 摸鼻子
      showConfirm({
        title: '发动摸鼻子',
        message: '确定要发动"摸鼻子"吗？现在开始摸鼻子，最后一个摸的人喝酒！',
        icon: '👃',
        confirmText: '发动',
        onConfirm: () => {
          socket.emit('activateCard', { cardId: card.id });
        }
      });
      break;
    case '8': // 厕所牌 - 可以使用或转让
      showToiletCardOptions(card);
      break;
    case '10': // 神经病 - 可以触发惩罚
      currentSelectAction = { type: 'crazyTrigger', cardId: card.id };
      showPlayerSelectModal('谁和你说话了？选择喝酒的人', true);
      break;
    case '2': // 小姐牌 - 只显示信息
      showAlert({
        title: '小姐牌',
        message: '你是小姐！有人喝酒时你要说"大爷您喝好"并陪喝，直到下一个小姐出现。',
        icon: '👸'
      });
      break;
  }
}

// 显示厕所牌选项
function showToiletCardOptions(card) {
  showOptions({
    title: '厕所牌',
    message: '请选择要执行的操作',
    icon: '🚽',
    items: [
      {
        text: '🚶 自己使用（上厕所）',
        onClick: () => {
          socket.emit('activateCard', { cardId: card.id });
          showAlert({
            title: '厕所牌已使用',
            message: '你使用了厕所牌，可以去上厕所了！牌已放入弃牌堆。',
            icon: '🚽'
          });
        }
      },
      {
        text: '🎁 转让给他人',
        onClick: () => {
          currentSelectAction = { type: 'transferToilet', cardId: card.id };
          showPlayerSelectModal('选择要转让厕所牌的玩家', true);
        }
      }
    ],
    cancelText: '取消'
  });
}

// 显示玩家选择弹窗
function showPlayerSelectModal(title, excludeSelf = false) {
  playerSelectTitle.textContent = title;
  playerSelectList.innerHTML = '';
  
  currentRoom.players.forEach(player => {
    if (excludeSelf && player.id === currentPlayer.id) return;
    
    const item = document.createElement('div');
    item.className = 'player-select-item';
    item.textContent = player.name;
    item.addEventListener('click', () => handlePlayerSelect(player));
    playerSelectList.appendChild(item);
  });
  
  playerSelectModal.classList.remove('hidden');
}

// 处理玩家选择
function handlePlayerSelect(player) {
  playerSelectModal.classList.add('hidden');
  
  if (!currentSelectAction) return;
  
  switch (currentSelectAction.type) {
    case 'transferToilet':
      socket.emit('transferToiletCard', { targetPlayerId: player.id });
      showToast(`厕所牌已转让给 ${player.name}`);
      break;
    case 'crazyTrigger':
      socket.emit('crazyTriggered', { victimId: player.id });
      break;
  }
  
  currentSelectAction = null;
}

// 更新特殊状态显示
function updateSpecialStatus(room) {
  // 小姐持有者
  if (room.missHolders && room.missHolders.length > 0) {
    missHolders.classList.remove('hidden');
    missHolders.classList.add('miss');
    missHolders.querySelector('.holder-names').textContent = 
      room.missHolders.map(h => h.playerName).join(', ');
  } else {
    missHolders.classList.add('hidden');
  }
  
  // 神经病持有者
  if (room.crazyHolders && room.crazyHolders.length > 0) {
    crazyHolders.classList.remove('hidden');
    crazyHolders.classList.add('crazy');
    crazyHolders.querySelector('.holder-names').textContent = 
      room.crazyHolders.map(h => h.playerName).join(', ');
  } else {
    crazyHolders.classList.add('hidden');
  }
  
  // K规则
  if (room.currentKRule) {
    kRuleDisplay.classList.remove('hidden');
    kRuleDisplay.classList.add('k-rule');
    kRuleDisplay.querySelector('.rule-text').textContent = room.currentKRule;
  } else {
    kRuleDisplay.classList.add('hidden');
  }
}

// 显示卡牌
function displayCard(card) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  
  cardDisplay.classList.add('flipping');
  
  setTimeout(() => {
    cardDisplay.className = 'card card-front';
    cardDisplay.innerHTML = `
      <span class="card-corner top-left ${isRed ? 'card-red' : 'card-black'}">${card.value}<br>${card.suit}</span>
      <span class="card-suit ${isRed ? 'card-red' : 'card-black'}">${card.suit}</span>
      <span class="card-value ${isRed ? 'card-red' : 'card-black'}">${card.value}</span>
      <span class="card-corner bottom-right ${isRed ? 'card-red' : 'card-black'}">${card.value}<br>${card.suit}</span>
    `;
    
    // 显示规则
    const icon = card.rule?.icon || '';
    ruleName.textContent = `${card.value} - ${icon} ${card.rule.name}`;
    ruleDescription.textContent = card.rule.rule;
    cardRule.classList.remove('hidden');
    
    cardDisplay.classList.remove('flipping');
  }, 300);
}

// 重置卡牌显示
function resetCardDisplay() {
  cardDisplay.className = 'card card-back';
  cardDisplay.innerHTML = '<span class="card-text">?</span>';
  cardRule.classList.add('hidden');
  actionMessage.textContent = '';
  kRuleInput.classList.add('hidden');
}

// ==================== 事件监听 ====================

// 创建房间
createRoomBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    showToast('请输入昵称');
    return;
  }
  socket.emit('createRoom', name);
});

// 显示加入房间表单
joinRoomBtn.addEventListener('click', () => {
  joinRoomForm.classList.toggle('hidden');
});

// 确认加入房间
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
  const roomId = roomIdDisplay.textContent;
  navigator.clipboard.writeText(roomId).then(() => {
    showToast('房间号已复制');
  }).catch(() => {
    showToast('复制失败，请手动复制');
  });
});

// 开始游戏
startGameBtn.addEventListener('click', () => {
  socket.emit('startGame');
});

// 抽牌
drawCardBtn.addEventListener('click', () => {
  socket.emit('drawCard');
});

// 设置K规则
setKRuleBtn.addEventListener('click', () => {
  const rule = kRuleText.value.trim();
  if (!rule) {
    showToast('请输入K规则');
    return;
  }
  socket.emit('setKRule', rule);
  kRuleInput.classList.add('hidden');
  kRuleText.value = '';
});

// 洗牌
shuffleBtn.addEventListener('click', () => {
  showConfirm({
    title: '开始新一轮',
    message: '确定要开始新一轮吗？所有已抽的牌将重新洗入牌堆。',
    icon: '🔄',
    confirmText: '开始',
    onConfirm: () => {
      socket.emit('shuffleDeck');
    }
  });
});

// 规则弹窗
rulesBtn.addEventListener('click', () => {
  rulesModal.classList.remove('hidden');
});

closeModal.addEventListener('click', () => {
  rulesModal.classList.add('hidden');
});

rulesModal.addEventListener('click', (e) => {
  if (e.target === rulesModal) {
    rulesModal.classList.add('hidden');
  }
});

// 玩家选择弹窗
closePlayerSelect.addEventListener('click', () => {
  playerSelectModal.classList.add('hidden');
  currentSelectAction = null;
});

playerSelectModal.addEventListener('click', (e) => {
  if (e.target === playerSelectModal) {
    playerSelectModal.classList.add('hidden');
    currentSelectAction = null;
  }
});

// ==================== Socket 事件处理 ====================

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
  showToast('房间创建成功！分享房间号给朋友');
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
  
  if (data.room.gameStarted) {
    // 如果游戏已开始，直接进入游戏界面
    enterGameScreen(data.room);
  } else {
    showScreen('lobby');
  }
  
  showToast('加入房间成功！');
});

// 有新玩家加入
socket.on('playerJoined', (data) => {
  currentRoom = data.room;
  updatePlayersList(data.room.players);
  showToast(`${data.player.name} 加入了房间`);
});

socket.on('playerRejoined', (data) => {
  currentRoom = data.room;
  updatePlayersList(data.room.players);
  if (data.room.gameStarted) {
    const currentPlayerObj = data.room.players[data.room.currentPlayerIndex];
    updateGamePlayersList(data.room.players, currentPlayerObj?.id);
    updateSpecialStatus(data.room);
  }
  showToast(`${data.player.name} 回到了房间`);
});

// 玩家离开
socket.on('playerLeft', (data) => {
  currentRoom = data.room;
  
  // 检查自己是否变成房主
  const me = data.room.players.find(p => p.id === currentPlayer.id);
  if (me && me.isHost && !isHost) {
    isHost = true;
    hostControls.classList.remove('hidden');
    hostGameControls.classList.remove('hidden');
    waitingMessage.classList.add('hidden');
    showToast('你已成为新房主');
  }
  
  updatePlayersList(data.room.players);
  
  if (data.room.gameStarted) {
    const currentPlayerObj = data.room.players[data.room.currentPlayerIndex];
    updateGamePlayersList(data.room.players, currentPlayerObj?.id);
    updateMyHand(data.room);
    updateSpecialStatus(data.room);
  }
  
  showToast(`${data.player.name} 离开了房间`);
});

// 进入游戏界面
function enterGameScreen(room) {
  gameRoomId.textContent = room.id;
  roundNumber.textContent = room.roundNumber;
  deckRemaining.textContent = room.deckRemaining;
  kingsCount.textContent = `👑 ${room.kingsDrawn}/4`;
  
  const currentPlayerObj = room.players[room.currentPlayerIndex];
  updateGamePlayersList(room.players, currentPlayerObj?.id);
  updateMyHand(room);
  updateSpecialStatus(room);
  
  if (currentPlayerObj?.id === currentPlayer.id) {
    currentTurn.textContent = '轮到你抽牌！';
    drawCardBtn.disabled = false;
  } else {
    currentTurn.textContent = `等待 ${currentPlayerObj?.name || '...'} 抽牌...`;
    drawCardBtn.disabled = true;
  }
  
  if (isHost) {
    hostGameControls.classList.remove('hidden');
  }
  
  resetCardDisplay();
  showScreen('game');
}

// 游戏开始
socket.on('gameStarted', (data) => {
  currentRoom = data.room;
  enterGameScreen(data.room);
  showToast('游戏开始！');
});

// 有人抽牌
socket.on('cardDrawn', (data) => {
  currentRoom = data.room;
  
  displayCard(data.card);
  deckRemaining.textContent = data.room.deckRemaining;
  roundNumber.textContent = data.room.roundNumber;
  kingsCount.textContent = `👑 ${data.kingsDrawn}/4`;
  
  lastDraw.textContent = `${data.drawnBy.name} 抽到了 ${data.card.display}`;
  
  // 显示特殊动作消息
  if (data.cardAction.message) {
    actionMessage.textContent = data.cardAction.message;
  }
  
  updateGamePlayersList(data.room.players, data.nextPlayer?.id);
  updateMyHand(data.room);
  updateSpecialStatus(data.room);
  
  // 如果是自己抽到K（不是第4张），显示输入框
  if (data.cardAction.type === 'setKRule' && data.drawnBy.id === currentPlayer.id) {
    kRuleInput.classList.remove('hidden');
    kRuleText.focus();
  }
  
  // 回合结束
  if (data.gameEnded) {
    currentTurn.textContent = '🎉 本轮结束！';
    drawCardBtn.disabled = true;
    showAlert({
      title: '本轮结束！',
      message: '4个K都抽完了！房主可以点击"新一轮"开始下一轮游戏。',
      icon: '👑',
      buttonText: '好的'
    });
    return;
  }
  
  if (data.nextPlayer?.id === currentPlayer.id) {
    currentTurn.textContent = '轮到你抽牌！';
    drawCardBtn.disabled = false;
  } else {
    currentTurn.textContent = `等待 ${data.nextPlayer?.name || '...'} 抽牌...`;
    drawCardBtn.disabled = true;
  }
});

// K规则设置
socket.on('kRuleSet', (data) => {
  currentRoom = data.room;
  updateSpecialStatus(data.room);
  showToast(`${data.setBy} 设定了K规则: ${data.rule}`);
});

// 牌被发动
socket.on('cardActivated', (data) => {
  currentRoom = data.room;
  updateMyHand(data.room);
  updateGamePlayersList(data.room.players, data.room.players[data.room.currentPlayerIndex]?.id);
  
  let title = '';
  let message = '';
  let icon = '';
  
  switch (data.card.value) {
    case '5':
      title = '照相机！';
      message = `${data.activatedBy.name} 发动了照相机！所有动的人喝酒！`;
      icon = '📷';
      break;
    case '6':
      title = '摸鼻子！';
      message = `${data.activatedBy.name} 摸鼻子了！最后一个摸的人喝酒！`;
      icon = '👃';
      break;
    case '8':
      title = '上厕所';
      message = `${data.activatedBy.name} 使用了厕所牌去上厕所了！`;
      icon = '🚽';
      break;
  }
  
  showAlert({ title, message, icon });
});

// 神经病被触发
socket.on('crazyTriggered', (data) => {
  currentRoom = data.room;
  updateMyHand(data.room);
  updateSpecialStatus(data.room);
  
  showAlert({
    title: '神经病触发！',
    message: `${data.victim.name} 和神经病 ${data.crazyPlayer.name} 说话了！${data.victim.name} 喝酒！`,
    icon: '🤪'
  });
});

// 厕所牌转让
socket.on('toiletCardTransferred', (data) => {
  currentRoom = data.room;
  updateMyHand(data.room);
  updateGamePlayersList(data.room.players, data.room.players[data.room.currentPlayerIndex]?.id);
  
  showAlert({
    title: '厕所牌转让',
    message: `${data.from.name} 把厕所牌给了 ${data.to.name}`,
    icon: '🚽'
  });
});

// 牌抽完了
socket.on('deckEmpty', (data) => {
  drawCardBtn.disabled = true;
  currentTurn.textContent = '牌已抽完！房主可以开始新一轮';
  
  showAlert({
    title: '牌已抽完',
    message: '所有牌都抽完了！房主可以点击"新一轮"开始下一轮游戏。',
    icon: '🃏'
  });
});

// 洗牌（新一轮）
socket.on('deckShuffled', (data) => {
  currentRoom = data.room;
  
  deckRemaining.textContent = data.room.deckRemaining;
  roundNumber.textContent = data.room.roundNumber;
  kingsCount.textContent = `👑 0/4`;
  
  resetCardDisplay();
  lastDraw.textContent = '';
  
  updateGamePlayersList(data.room.players, data.currentPlayer?.id);
  updateMyHand(data.room);
  updateSpecialStatus(data.room);
  
  if (data.currentPlayer?.id === currentPlayer.id) {
    currentTurn.textContent = '轮到你抽牌！';
    drawCardBtn.disabled = false;
  } else {
    currentTurn.textContent = `等待 ${data.currentPlayer?.name || '...'} 抽牌...`;
    drawCardBtn.disabled = true;
  }
  
  showAlert({
    title: data.message,
    message: `新的一轮开始了！牌堆已重新洗牌，共${data.room.deckRemaining}张牌。`,
    icon: '🔄'
  });
});

// 房间状态更新
socket.on('roomState', (data) => {
  currentRoom = data.room;
  if (data.room.gameStarted) {
    updateMyHand(data.room);
    updateSpecialStatus(data.room);
  }
});

// 错误处理
socket.on('error', (data) => {
  showAlert({
    title: '提示',
    message: data.message,
    icon: '⚠️'
  });
});

// 连接断开
socket.on('disconnect', () => {
  showAlert({
    title: '连接断开',
    message: '与服务器的连接已断开，请刷新页面重新连接。',
    icon: '🔌',
    buttonText: '刷新页面',
    onClose: () => {
      location.reload();
    }
  });
});

// 重新连接
socket.on('connect', () => {
  if (currentRoom && currentPlayer) {
    // 尝试重新加入房间
    socket.emit('rejoinRoom', {
      roomId: currentRoom.id,
      playerId: currentPlayer.id,
      playerName: currentPlayer.name
    });
  }
});

// 阻止双击缩放
document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// ==================== 游戏预览功能 ====================

// 预览用的卡牌规则数据
const previewCardRules = {
  'A': { name: '点杀', rule: '指定任意一人喝酒', icon: '🎯', type: 'instant' },
  '2': { name: '小姐牌', rule: '在下一个小姐出现之前陪酒，并说"大爷您喝好"', icon: '👸', type: 'hold' },
  '3': { name: '逛三园', rule: '说"动物园/水果园/蔬菜园里有什么"，轮流说，说不出或重复的人喝', icon: '🦁', type: 'instant' },
  '4': { name: '找人PK', rule: '选一人进行猜拳或其他PK，输的人喝酒', icon: '⚔️', type: 'instant' },
  '5': { name: '照相机', rule: '随时可喊"照相机"，此时动的人喝酒（保留在手中直到发动）', icon: '📷', type: 'hold' },
  '6': { name: '摸鼻子', rule: '随时可摸鼻子，最后一个摸的人喝酒（保留在手中直到发动）', icon: '👃', type: 'hold' },
  '7': { name: '逢7过', rule: '从1开始报数，逢7、7的倍数、含7的数字要拍手跳过，错的人喝', icon: '7️⃣', type: 'instant' },
  '8': { name: '厕所牌', rule: '拥有此牌才能上厕所，可转让给他人（跨回合保留）', icon: '🚽', type: 'hold' },
  '9': { name: '自己喝', rule: '抽到此牌的人自己喝一杯', icon: '🍺', type: 'instant' },
  '10': { name: '神经病', rule: '所有人不能和你对话，否则喝酒（保留直到有人中招）', icon: '🤪', type: 'hold' },
  'J': { name: '上家喝', rule: '你的上家（上一个抽牌的人）喝酒', icon: '⬆️', type: 'instant' },
  'Q': { name: '下家喝', rule: '你的下家（下一个抽牌的人）喝酒', icon: '⬇️', type: 'instant' },
  'K': { name: '定K规则', rule: '定义下一个抽到K的人要做什么（4个K抽完本轮结束）', icon: '👑', type: 'instant' }
};

const previewSuits = ['♠', '♥', '♦', '♣'];
const previewValues = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// 预览界面元素
const previewBtn = document.getElementById('preview-btn');
const exitPreviewBtn = document.getElementById('exit-preview-btn');
const previewCard = document.getElementById('preview-card');
const previewRuleName = document.getElementById('preview-rule-name');
const previewRuleDesc = document.getElementById('preview-rule-desc');
const previewDrawBtn = document.getElementById('preview-draw-btn');
const previewStartBtn = document.getElementById('preview-start-btn');
const previewCardItems = document.querySelectorAll('.preview-card-item');

// 显示预览卡牌
function showPreviewCard(value, suit = null) {
  const rule = previewCardRules[value];
  if (!suit) {
    suit = previewSuits[Math.floor(Math.random() * previewSuits.length)];
  }
  
  const isRed = suit === '♥' || suit === '♦';
  previewCard.className = `card ${isRed ? 'card-red' : 'card-black'}`;
  previewCard.innerHTML = `
    <span class="card-corner top-left">${suit}${value}</span>
    <span class="card-center">${suit}</span>
    <span class="card-corner bottom-right">${suit}${value}</span>
  `;
  
  // 添加翻转动画
  previewCard.classList.add('card-flip');
  setTimeout(() => previewCard.classList.remove('card-flip'), 300);
  
  // 显示规则
  previewRuleName.textContent = `${rule.icon} ${value} - ${rule.name}`;
  previewRuleDesc.textContent = rule.rule;
  
  // 高亮当前选中的卡牌项
  previewCardItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.value === value) {
      item.classList.add('active');
    }
  });
  
  // 根据类型添加标记
  const typeLabel = rule.type === 'hold' ? ' (保留手牌)' : '';
  previewRuleDesc.textContent = rule.rule + typeLabel;
}

// 随机抽一张牌
function previewRandomDraw() {
  const value = previewValues[Math.floor(Math.random() * previewValues.length)];
  const suit = previewSuits[Math.floor(Math.random() * previewSuits.length)];
  showPreviewCard(value, suit);
}

// 进入预览模式
if (previewBtn) {
  previewBtn.addEventListener('click', () => {
    showScreen('preview');
    // 默认显示 A
    showPreviewCard('A');
  });
}

// 退出预览模式
if (exitPreviewBtn) {
  exitPreviewBtn.addEventListener('click', () => {
    showScreen('home');
  });
}

// 随机抽牌按钮
if (previewDrawBtn) {
  previewDrawBtn.addEventListener('click', () => {
    previewRandomDraw();
  });
}

// 点击卡牌项查看规则
previewCardItems.forEach(item => {
  item.addEventListener('click', () => {
    showPreviewCard(item.dataset.value);
  });
});

// 预览界面的开始游戏按钮
if (previewStartBtn) {
  previewStartBtn.addEventListener('click', () => {
    showScreen('home');
    playerNameInput.focus();
  });
}
