const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 存储房间数据
const rooms = new Map();

// 牌的类型：
// 'instant' - 即时生效，直接进入弃牌堆
// 'hold' - 保留在手中，满足条件后弃置
// 'toilet' - 厕所牌，特殊规则
const cardTypes = {
  'A': 'instant',
  '2': 'hold',      // 小姐牌 - 下一个2出现才弃置
  '3': 'instant',
  '4': 'instant',
  '5': 'hold',      // 照相机 - 发动后弃置
  '6': 'hold',      // 摸鼻子 - 发动后弃置
  '7': 'instant',
  '8': 'toilet',    // 厕所牌 - 特殊规则
  '9': 'instant',
  '10': 'hold',     // 神经病 - 有人中招后弃置
  'J': 'instant',
  'Q': 'instant',
  'K': 'instant'
};

// 小姐牌规则
const cardRules = {
  'A': { name: '点杀', rule: '指定任意一人喝酒', icon: '🎯' },
  '2': { name: '小姐牌', rule: '在下一个小姐出现之前陪酒，并说"大爷您喝好"', icon: '👸', holdType: 'miss' },
  '3': { name: '逛三园', rule: '说"动物园/水果园/蔬菜园里有什么"，轮流说，说不出或重复的人喝', icon: '🦁' },
  '4': { name: '找人PK', rule: '选一人进行猜拳或其他PK，输的人喝酒', icon: '⚔️' },
  '5': { name: '照相机', rule: '随时可喊"照相机"，此时动的人喝酒（保留在手中直到发动）', icon: '📷', holdType: 'camera' },
  '6': { name: '摸鼻子', rule: '随时可摸鼻子，最后一个摸的人喝酒（保留在手中直到发动）', icon: '👃', holdType: 'nose' },
  '7': { name: '逢7过', rule: '从1开始报数，逢7、7的倍数、含7的数字要拍手跳过，错的人喝', icon: '7️⃣' },
  '8': { name: '厕所牌', rule: '拥有此牌才能上厕所，可转让给他人（跨回合保留）', icon: '🚽', holdType: 'toilet' },
  '9': { name: '自己喝', rule: '抽到此牌的人自己喝一杯', icon: '🍺' },
  '10': { name: '神经病', rule: '所有人不能和你对话，否则喝酒（保留直到有人中招）', icon: '🤪', holdType: 'crazy' },
  'J': { name: '上家喝', rule: '你的上家（上一个抽牌的人）喝酒', icon: '⬆️' },
  'Q': { name: '下家喝', rule: '你的下家（下一个抽牌的人）喝酒', icon: '⬇️' },
  'K': { name: '定K规则', rule: '定义下一个抽到K的人要做什么（4个K抽完本轮结束）', icon: '👑' }
};

// 生成一副完整的牌
function generateDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  
  for (const suit of suits) {
    for (const value of values) {
      deck.push({
        id: uuidv4(),
        suit,
        value,
        display: `${suit}${value}`,
        rule: cardRules[value],
        type: cardTypes[value]
      });
    }
  }
  
  return deck;
}

// 洗牌算法 (Fisher-Yates)
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 创建新房间
function createRoom(roomId, hostName) {
  const deck = shuffleDeck(generateDeck());
  return {
    id: roomId,
    players: [],
    deck,
    discardPile: [],        // 弃牌堆
    currentPlayerIndex: 0,
    kingsDrawn: 0,
    currentKRule: null,     // 当前K规则
    gameStarted: false,
    roundNumber: 1,         // 当前回合数
    toiletCardRounds: 3,    // 厕所牌保留回合数
    createdAt: new Date()
  };
}

// 检查并处理小姐牌交接（当新的2被抽到时）
function handleMissCardTransfer(room, newMissHolderId) {
  const discarded = [];
  room.players.forEach(player => {
    if (player.id !== newMissHolderId) {
      const missCards = player.hand.filter(c => c.value === '2');
      missCards.forEach(card => {
        // 移到弃牌堆
        player.hand = player.hand.filter(c => c.id !== card.id);
        room.discardPile.push(card);
        discarded.push({ player: player.name, card });
      });
    }
  });
  return discarded;
}

// 获取当前持有特定牌的玩家
function getCardHolders(room, cardValue) {
  const holders = [];
  room.players.forEach(player => {
    const cards = player.hand.filter(c => c.value === cardValue);
    if (cards.length > 0) {
      holders.push({
        playerId: player.id,
        playerName: player.name,
        cards: cards
      });
    }
  });
  return holders;
}

// 获取房间状态（安全版本，不暴露牌堆详情）
function getRoomState(room, forPlayerId = null) {
  return {
    id: room.id,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      handCount: p.hand.length,
      // 显示手牌信息（其他人只能看到牌值，不能看花色）
      handCards: p.hand.map(c => ({
        id: c.id,
        value: c.value,
        rule: c.rule,
        type: c.type,
        toiletRoundsLeft: c.toiletRoundsLeft,
        // 只有自己能看到完整信息
        ...(p.id === forPlayerId ? { suit: c.suit, display: c.display } : {})
      }))
    })),
    deckRemaining: room.deck.length,
    discardPileCount: room.discardPile.length,
    currentPlayerIndex: room.currentPlayerIndex,
    kingsDrawn: room.kingsDrawn,
    currentKRule: room.currentKRule,
    gameStarted: room.gameStarted,
    roundNumber: room.roundNumber,
    toiletCardRounds: room.toiletCardRounds,
    // 特殊状态
    missHolders: getCardHolders(room, '2'),
    crazyHolders: getCardHolders(room, '10'),
    cameraHolders: getCardHolders(room, '5'),
    noseHolders: getCardHolders(room, '6'),
    toiletHolders: getCardHolders(room, '8')
  };
}

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);
  
  // 创建房间
  socket.on('createRoom', (playerName) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = createRoom(roomId, playerName);
    
    const player = {
      id: socket.id,
      name: playerName,
      isHost: true,
      hand: []  // 玩家手牌
    };
    
    room.players.push(player);
    rooms.set(roomId, room);
    
    socket.join(roomId);
    socket.roomId = roomId;
    
    socket.emit('roomCreated', {
      roomId,
      player: { id: player.id, name: player.name, isHost: player.isHost, handCount: 0, handCards: [] },
      room: getRoomState(room, socket.id)
    });
    
    console.log(`房间 ${roomId} 已创建，房主: ${playerName}`);
  });
  
  // 加入房间
  socket.on('joinRoom', ({ roomId, playerName }) => {
    const room = rooms.get(roomId.toUpperCase());
    
    if (!room) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }
    
    if (room.players.length >= 10) {
      socket.emit('error', { message: '房间已满（最多10人）' });
      return;
    }
    
    // 检查是否重复加入
    const existingPlayer = room.players.find(p => p.id === socket.id);
    if (existingPlayer) {
      socket.emit('roomJoined', {
        roomId: room.id,
        player: { id: existingPlayer.id, name: existingPlayer.name, isHost: existingPlayer.isHost, handCount: existingPlayer.hand.length, handCards: existingPlayer.hand },
        room: getRoomState(room, socket.id)
      });
      return;
    }
    
    const player = {
      id: socket.id,
      name: playerName,
      isHost: false,
      hand: []
    };
    
    room.players.push(player);
    socket.join(roomId.toUpperCase());
    socket.roomId = roomId.toUpperCase();
    
    socket.emit('roomJoined', {
      roomId: room.id,
      player: { id: player.id, name: player.name, isHost: player.isHost, handCount: 0, handCards: [] },
      room: getRoomState(room, socket.id)
    });
    
    // 通知房间内其他玩家
    room.players.forEach(p => {
      if (p.id !== socket.id) {
        io.to(p.id).emit('playerJoined', {
          player: { id: player.id, name: player.name, isHost: player.isHost },
          room: getRoomState(room, p.id)
        });
      }
    });
    
    console.log(`${playerName} 加入房间 ${roomId}`);
  });
  
  // 开始游戏
  socket.on('startGame', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      socket.emit('error', { message: '只有房主可以开始游戏' });
      return;
    }
    
    if (room.players.length < 2) {
      socket.emit('error', { message: '至少需要2名玩家才能开始' });
      return;
    }
    
    room.gameStarted = true;
    room.currentPlayerIndex = 0;
    
    // 给每个玩家发送个性化的房间状态
    room.players.forEach(p => {
      io.to(p.id).emit('gameStarted', {
        currentPlayer: { id: room.players[room.currentPlayerIndex].id, name: room.players[room.currentPlayerIndex].name },
        room: getRoomState(room, p.id)
      });
    });
    
    console.log(`房间 ${room.id} 游戏开始`);
  });
  
  // 抽牌
  socket.on('drawCard', () => {
    const room = rooms.get(socket.roomId);
    if (!room || !room.gameStarted) return;
    
    // 检查是否已经结束（4个K）
    if (room.kingsDrawn >= 4) {
      socket.emit('error', { message: '本轮已结束，请房主开始新一轮' });
      return;
    }
    
    const currentPlayer = room.players[room.currentPlayerIndex];
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: '还没轮到你抽牌' });
      return;
    }
    
    if (room.deck.length === 0) {
      io.to(room.id).emit('deckEmpty', { message: '牌已抽完，请洗牌重新开始' });
      return;
    }
    
    // 抽一张牌
    const card = room.deck.pop();
    
    // 计算上家和下家
    const prevPlayerIndex = (room.currentPlayerIndex - 1 + room.players.length) % room.players.length;
    const nextPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
    const prevPlayer = room.players[prevPlayerIndex];
    const nextPlayer = room.players[nextPlayerIndex];
    
    // 处理不同类型的牌
    let cardAction = {
      type: 'instant',
      message: '',
      specialEvent: null
    };
    
    let discardedMissCards = [];
    
    switch (card.value) {
      case '2': // 小姐牌
        // 先让之前持有2的人弃置
        discardedMissCards = handleMissCardTransfer(room, currentPlayer.id);
        // 新的2加入手牌
        currentPlayer.hand.push(card);
        cardAction = { 
          type: 'hold', 
          message: `${currentPlayer.name} 成为新的小姐！`,
          specialEvent: 'newMiss',
          discardedMissCards
        };
        break;
        
      case '5': // 照相机
        currentPlayer.hand.push(card);
        cardAction = { type: 'hold', message: `${currentPlayer.name} 获得了照相机📷，可随时发动！`, specialEvent: 'camera' };
        break;
        
      case '6': // 摸鼻子
        currentPlayer.hand.push(card);
        cardAction = { type: 'hold', message: `${currentPlayer.name} 获得了摸鼻子👃，可随时发动！`, specialEvent: 'nose' };
        break;
        
      case '8': // 厕所牌
        currentPlayer.hand.push(card);
        card.toiletRoundsLeft = room.toiletCardRounds; // 标记剩余回合数
        cardAction = { type: 'hold', message: `${currentPlayer.name} 获得了厕所牌🚽！（保留${room.toiletCardRounds}回合）`, specialEvent: 'toilet' };
        break;
        
      case '10': // 神经病
        currentPlayer.hand.push(card);
        cardAction = { type: 'hold', message: `${currentPlayer.name} 变成了神经病🤪！所有人不能和TA对话！`, specialEvent: 'crazy' };
        break;
        
      case 'K':
        room.kingsDrawn++;
        room.discardPile.push(card);
        if (room.kingsDrawn >= 4) {
          cardAction = { type: 'roundEnd', message: '👑 第4张K被抽出！本轮结束！', specialEvent: 'roundEnd' };
        } else {
          cardAction = { 
            type: 'setKRule', 
            message: `👑 请定义下一个K的惩罚（已抽${room.kingsDrawn}/4张K）`,
            specialEvent: 'kRule',
            needInput: true
          };
        }
        break;
        
      case 'J':
        room.discardPile.push(card);
        cardAction = { type: 'instant', message: `⬆️ 上家 ${prevPlayer.name} 喝酒！`, targetPlayer: prevPlayer.name };
        break;
        
      case 'Q':
        room.discardPile.push(card);
        cardAction = { type: 'instant', message: `⬇️ 下家 ${nextPlayer.name} 喝酒！`, targetPlayer: nextPlayer.name };
        break;
        
      case 'A':
        room.discardPile.push(card);
        cardAction = { type: 'instant', message: `🎯 ${currentPlayer.name} 可以点杀任意一人！`, specialEvent: 'pointKill' };
        break;
        
      case '9':
        room.discardPile.push(card);
        cardAction = { type: 'instant', message: `🍺 ${currentPlayer.name} 自己喝一杯！` };
        break;
        
      default:
        room.discardPile.push(card);
        cardAction = { type: 'instant', message: '' };
    }
    
    // 计算下一个玩家（如果不是回合结束）
    let gameEnded = room.kingsDrawn >= 4;
    if (!gameEnded) {
      room.currentPlayerIndex = nextPlayerIndex;
    }
    
    // 广播抽牌结果
    room.players.forEach(p => {
      io.to(p.id).emit('cardDrawn', {
        card: {
          id: card.id,
          suit: card.suit,
          value: card.value,
          display: card.display,
          rule: card.rule,
          type: card.type
        },
        drawnBy: { id: currentPlayer.id, name: currentPlayer.name },
        nextPlayer: gameEnded ? null : { id: room.players[room.currentPlayerIndex].id, name: room.players[room.currentPlayerIndex].name },
        prevPlayer: { id: prevPlayer.id, name: prevPlayer.name },
        cardAction,
        kingsDrawn: room.kingsDrawn,
        currentKRule: room.currentKRule,
        gameEnded,
        room: getRoomState(room, p.id)
      });
    });
    
    console.log(`${currentPlayer.name} 抽到 ${card.display}`);
  });
  
  // 设置K规则
  socket.on('setKRule', (rule) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    
    room.currentKRule = rule;
    
    const player = room.players.find(p => p.id === socket.id);
    
    room.players.forEach(p => {
      io.to(p.id).emit('kRuleSet', {
        rule,
        setBy: player?.name,
        room: getRoomState(room, p.id)
      });
    });
    
    console.log(`K规则设定: ${rule}`);
  });
  
  // 发动手牌效果（照相机、摸鼻子等）
  socket.on('activateCard', ({ cardId }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      socket.emit('error', { message: '你没有这张牌' });
      return;
    }
    
    const card = player.hand[cardIndex];
    
    // 只有5、6、8可以主动发动
    if (card.value !== '5' && card.value !== '6' && card.value !== '8') {
      socket.emit('error', { message: '这张牌不能主动发动' });
      return;
    }
    
    // 从手牌移除并加入弃牌堆
    player.hand.splice(cardIndex, 1);
    room.discardPile.push(card);
    
    // 广播发动效果
    room.players.forEach(p => {
      io.to(p.id).emit('cardActivated', {
        card: {
          id: card.id,
          value: card.value,
          rule: card.rule
        },
        activatedBy: { id: player.id, name: player.name },
        room: getRoomState(room, p.id)
      });
    });
    
    console.log(`${player.name} 发动了 ${card.display} - ${card.rule.name}`);
  });
  
  // 神经病被触发（有人和神经病说话）
  socket.on('crazyTriggered', ({ victimId }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    
    const crazyPlayer = room.players.find(p => p.id === socket.id);
    const victim = room.players.find(p => p.id === victimId);
    
    if (!crazyPlayer || !victim) return;
    
    // 找到神经病牌并弃置
    const crazyCardIndex = crazyPlayer.hand.findIndex(c => c.value === '10');
    if (crazyCardIndex === -1) {
      socket.emit('error', { message: '你没有神经病牌' });
      return;
    }
    
    const card = crazyPlayer.hand[crazyCardIndex];
    crazyPlayer.hand.splice(crazyCardIndex, 1);
    room.discardPile.push(card);
    
    room.players.forEach(p => {
      io.to(p.id).emit('crazyTriggered', {
        crazyPlayer: { id: crazyPlayer.id, name: crazyPlayer.name },
        victim: { id: victim.id, name: victim.name },
        room: getRoomState(room, p.id)
      });
    });
    
    console.log(`${victim.name} 和神经病 ${crazyPlayer.name} 说话了，喝酒！`);
  });
  
  // 转让厕所牌
  socket.on('transferToiletCard', ({ targetPlayerId }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    
    const fromPlayer = room.players.find(p => p.id === socket.id);
    const toPlayer = room.players.find(p => p.id === targetPlayerId);
    
    if (!fromPlayer || !toPlayer) return;
    
    const toiletCardIndex = fromPlayer.hand.findIndex(c => c.value === '8');
    if (toiletCardIndex === -1) {
      socket.emit('error', { message: '你没有厕所牌' });
      return;
    }
    
    const card = fromPlayer.hand[toiletCardIndex];
    fromPlayer.hand.splice(toiletCardIndex, 1);
    toPlayer.hand.push(card);
    
    room.players.forEach(p => {
      io.to(p.id).emit('toiletCardTransferred', {
        from: { id: fromPlayer.id, name: fromPlayer.name },
        to: { id: toPlayer.id, name: toPlayer.name },
        room: getRoomState(room, p.id)
      });
    });
    
    console.log(`${fromPlayer.name} 把厕所牌给了 ${toPlayer.name}`);
  });
  
  // 洗牌（新一轮）
  socket.on('shuffleDeck', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      socket.emit('error', { message: '只有房主可以开始新一轮' });
      return;
    }
    
    // 收集所有牌（除了厕所牌需要特殊处理）
    let allCards = [...room.discardPile];
    room.discardPile = [];
    
    room.players.forEach(p => {
      // 分离厕所牌和其他手牌
      const toiletCards = p.hand.filter(c => c.value === '8');
      const otherCards = p.hand.filter(c => c.value !== '8');
      
      // 其他手牌放回牌堆
      allCards = allCards.concat(otherCards);
      
      // 处理厕所牌
      const remainingToiletCards = [];
      toiletCards.forEach(tc => {
        if (tc.toiletRoundsLeft !== undefined && tc.toiletRoundsLeft > 1) {
          tc.toiletRoundsLeft--;
          remainingToiletCards.push(tc);
        } else {
          // 厕所牌回合用完，放回牌堆
          allCards.push(tc);
        }
      });
      
      // 更新手牌（只保留还有回合的厕所牌）
      p.hand = remainingToiletCards;
    });
    
    room.deck = shuffleDeck(allCards);
    room.kingsDrawn = 0;
    room.currentKRule = null;
    room.currentPlayerIndex = 0;
    room.roundNumber++;
    
    room.players.forEach(p => {
      io.to(p.id).emit('deckShuffled', {
        currentPlayer: { id: room.players[room.currentPlayerIndex].id, name: room.players[room.currentPlayerIndex].name },
        message: `🔄 第 ${room.roundNumber} 轮开始！`,
        room: getRoomState(room, p.id)
      });
    });
    
    console.log(`房间 ${room.id} 第 ${room.roundNumber} 轮开始`);
  });
  
  // 获取房间状态
  socket.on('getRoomState', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    
    socket.emit('roomState', {
      room: getRoomState(room, socket.id)
    });
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log('用户断开:', socket.id);
    
    const room = rooms.get(socket.roomId);
    if (!room) return;
    
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;
    
    const player = room.players[playerIndex];
    
    // 将该玩家的手牌放入弃牌堆
    room.discardPile = room.discardPile.concat(player.hand);
    
    room.players.splice(playerIndex, 1);
    
    // 如果房主离开，转移房主权限
    if (player.isHost && room.players.length > 0) {
      room.players[0].isHost = true;
    }
    
    // 调整当前玩家索引
    if (room.currentPlayerIndex >= room.players.length) {
      room.currentPlayerIndex = 0;
    }
    
    // 如果房间空了，删除房间
    if (room.players.length === 0) {
      rooms.delete(socket.roomId);
      console.log(`房间 ${socket.roomId} 已删除`);
      return;
    }
    
    room.players.forEach(p => {
      io.to(p.id).emit('playerLeft', {
        player: { id: player.id, name: player.name },
        room: getRoomState(room, p.id)
      });
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
