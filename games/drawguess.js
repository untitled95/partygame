// 存储房间数据
const rooms = new Map();

// 从 JSON 文件加载词库
const path = require('path');
const fs = require('fs');

let words = {};

function loadWords() {
  try {
    const wordsPath = path.join(__dirname, '..', 'data', 'drawguess-words.json');
    const data = fs.readFileSync(wordsPath, 'utf8');
    words = JSON.parse(data);
    console.log(`[你画我猜] 词库加载成功，共 ${Object.keys(words).length} 个分类`);
  } catch (err) {
    console.error('[你画我猜] 词库加载失败:', err.message);
    // 使用备用词库
    words = {
      食物: ['苹果', '香蕉', '西瓜', '汉堡', '披萨'],
      动物: ['猫', '狗', '兔子', '大象', '老虎']
    };
  }
}

// 启动时加载词库
loadWords();

// 获取随机词语
function getRandomWord() {
  const categories = Object.keys(words);
  const category = categories[Math.floor(Math.random() * categories.length)];
  const wordList = words[category];
  const word = wordList[Math.floor(Math.random() * wordList.length)];
  return { category, word };
}

// 创建房间
function createRoom(roomId, hostId, hostName) {
  return {
    id: roomId,
    players: [{
      id: hostId,
      name: hostName,
      isHost: true,
      score: 0
    }],
    gameStarted: false,
    currentDrawerIndex: 0,
    currentWord: null,
    currentCategory: null,
    roundTime: 60,
    timeLeft: 60,
    roundNumber: 0,
    maxRounds: 3,
    guessedPlayers: [],
    drawingData: [],
    timer: null,
    createdAt: new Date()
  };
}

// 获取房间状态
function getRoomState(room, forPlayerId = null) {
  const currentDrawer = room.players[room.currentDrawerIndex];
  return {
    id: room.id,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      score: p.score,
      isDrawing: currentDrawer && p.id === currentDrawer.id
    })),
    gameStarted: room.gameStarted,
    currentDrawer: currentDrawer ? { id: currentDrawer.id, name: currentDrawer.name } : null,
    currentWord: forPlayerId === currentDrawer?.id ? room.currentWord : null,
    currentCategory: room.currentCategory,
    wordHint: room.currentWord ? room.currentWord.replace(/./g, '_ ').trim() : null,
    wordLength: room.currentWord ? room.currentWord.length : 0,
    roundTime: room.roundTime,
    timeLeft: room.timeLeft,
    roundNumber: room.roundNumber,
    maxRounds: room.maxRounds,
    guessedPlayers: room.guessedPlayers
  };
}

// 启动回合计时器
function startRoundTimer(room, io) {
  if (room.timer) clearInterval(room.timer);
  
  room.timer = setInterval(() => {
    room.timeLeft--;
    
    io.to(room.id).emit('timeUpdate', { timeLeft: room.timeLeft });
    
    if (room.timeLeft <= 0) {
      room.players.forEach(p => {
        io.to(p.id).emit('timeUp', { word: room.currentWord, room: getRoomState(room, p.id) });
      });
      
      setTimeout(() => nextRound(room, io), 3000);
    }
  }, 1000);
}

// 进入下一轮
function nextRound(room, io) {
  if (room.timer) clearInterval(room.timer);
  
  room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.players.length;
  
  if (room.currentDrawerIndex === 0) {
    room.roundNumber++;
  }
  
  if (room.roundNumber > room.maxRounds) {
    endGame(room, io);
    return;
  }
  
  const { category, word } = getRandomWord();
  room.currentWord = word;
  room.currentCategory = category;
  room.timeLeft = room.roundTime;
  room.guessedPlayers = [];
  room.drawingData = [];
  
  room.players.forEach(p => {
    io.to(p.id).emit('newRound', { room: getRoomState(room, p.id) });
  });
  
  startRoundTimer(room, io);
  
  console.log(`[你画我猜] 房间 ${room.id} 新回合，词语: ${word}`);
}

// 结束游戏
function endGame(room, io) {
  if (room.timer) clearInterval(room.timer);
  
  room.gameStarted = false;
  
  const rankings = [...room.players].sort((a, b) => b.score - a.score);
  
  room.players.forEach(p => {
    io.to(p.id).emit('gameEnded', { rankings, room: getRoomState(room, p.id) });
  });
  
  console.log(`[你画我猜] 房间 ${room.id} 游戏结束`);
}

// 初始化 Socket 事件
function initSocket(io) {
  const namespace = io.of('/drawguess');
  
  namespace.on('connection', (socket) => {
    console.log('[你画我猜] 用户连接:', socket.id);
    
    // 创建房间
    socket.on('createRoom', (playerName) => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const room = createRoom(roomId, socket.id, playerName);
      
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.roomId = roomId;
      
      socket.emit('roomCreated', {
        roomId,
        player: room.players[0],
        room: getRoomState(room, socket.id)
      });
      
      console.log(`[你画我猜] 房间 ${roomId} 已创建，房主: ${playerName}`);
    });
    
    // 加入房间
    socket.on('joinRoom', ({ roomId, playerName }) => {
      const room = rooms.get(roomId.toUpperCase());
      
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }
      
      if (room.gameStarted) {
        socket.emit('error', { message: '游戏已经开始，无法加入' });
        return;
      }
      
      if (room.players.length >= 8) {
        socket.emit('error', { message: '房间已满（最多8人）' });
        return;
      }
      
      const existingPlayer = room.players.find(p => p.id === socket.id);
      if (existingPlayer) {
        socket.emit('roomJoined', {
          roomId: room.id,
          player: existingPlayer,
          room: getRoomState(room, socket.id)
        });
        return;
      }
      
      const player = {
        id: socket.id,
        name: playerName,
        isHost: false,
        score: 0
      };
      
      room.players.push(player);
      socket.join(roomId.toUpperCase());
      socket.roomId = roomId.toUpperCase();
      
      socket.emit('roomJoined', {
        roomId: room.id,
        player,
        room: getRoomState(room, socket.id)
      });
      
      socket.to(room.id).emit('playerJoined', {
        player,
        room: getRoomState(room)
      });
      
      console.log(`[你画我猜] ${playerName} 加入房间 ${roomId}`);
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
      room.currentDrawerIndex = 0;
      room.roundNumber = 1;
      
      const { category, word } = getRandomWord();
      room.currentWord = word;
      room.currentCategory = category;
      room.timeLeft = room.roundTime;
      room.guessedPlayers = [];
      room.drawingData = [];
      
      room.players.forEach(p => {
        namespace.to(p.id).emit('gameStarted', { room: getRoomState(room, p.id) });
      });
      
      startRoundTimer(room, namespace);
      
      console.log(`[你画我猜] 房间 ${room.id} 游戏开始，词语: ${word}`);
    });
    
    // 绘画数据
    socket.on('drawing', (data) => {
      const room = rooms.get(socket.roomId);
      if (!room || !room.gameStarted) return;
      
      const currentDrawer = room.players[room.currentDrawerIndex];
      if (currentDrawer.id !== socket.id) return;
      
      room.drawingData.push(data);
      socket.to(room.id).emit('drawing', data);
    });
    
    // 清空画布
    socket.on('clearCanvas', () => {
      const room = rooms.get(socket.roomId);
      if (!room || !room.gameStarted) return;
      
      const currentDrawer = room.players[room.currentDrawerIndex];
      if (currentDrawer.id !== socket.id) return;
      
      room.drawingData = [];
      socket.to(room.id).emit('clearCanvas');
    });
    
    // 猜测
    socket.on('guess', (guessText) => {
      const room = rooms.get(socket.roomId);
      if (!room || !room.gameStarted) return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      
      const currentDrawer = room.players[room.currentDrawerIndex];
      
      if (player.id === currentDrawer.id) return;
      if (room.guessedPlayers.includes(player.id)) return;
      
      const isCorrect = guessText.trim() === room.currentWord;
      
      if (isCorrect) {
        room.guessedPlayers.push(player.id);
        
        const timeBonus = Math.floor(room.timeLeft / 10);
        const baseScore = 10;
        const score = baseScore + timeBonus;
        
        player.score += score;
        currentDrawer.score += 5;
        
        room.players.forEach(p => {
          namespace.to(p.id).emit('correctGuess', {
            player: { id: player.id, name: player.name },
            score,
            room: getRoomState(room, p.id)
          });
        });
        
        const nonDrawerCount = room.players.length - 1;
        if (room.guessedPlayers.length >= nonDrawerCount) {
          setTimeout(() => nextRound(room, namespace), 2000);
        }
      } else {
        namespace.to(room.id).emit('chatMessage', {
          player: { id: player.id, name: player.name },
          message: guessText,
          isSystem: false
        });
      }
    });
    
    // 断开连接
    socket.on('disconnect', () => {
      console.log('[你画我猜] 用户断开:', socket.id);
      
      const room = rooms.get(socket.roomId);
      if (!room) return;
      
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) return;
      
      const player = room.players[playerIndex];
      room.players.splice(playerIndex, 1);
      
      if (player.isHost && room.players.length > 0) {
        room.players[0].isHost = true;
      }
      
      if (room.players.length === 0) {
        if (room.timer) clearInterval(room.timer);
        rooms.delete(socket.roomId);
        console.log(`[你画我猜] 房间 ${socket.roomId} 已删除`);
        return;
      }
      
      if (room.gameStarted && room.currentDrawerIndex === playerIndex) {
        room.currentDrawerIndex = room.currentDrawerIndex % room.players.length;
        nextRound(room, namespace);
      } else if (room.currentDrawerIndex > playerIndex) {
        room.currentDrawerIndex--;
      }
      
      room.players.forEach(p => {
        namespace.to(p.id).emit('playerLeft', {
          player: { id: player.id, name: player.name },
          room: getRoomState(room, p.id)
        });
      });
    });
  });
}

module.exports = { initSocket };
