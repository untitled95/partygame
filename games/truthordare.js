// 真心话大冒险
const rooms = new Map();
const {
  attachSocketToPlayer,
  schedulePlayerRemoval,
  rejoinPlayer
} = require('./reconnect');

const prompts = {
  truth: [
    '最近一次让你尴尬的事情是什么？',
    '如果可以交换一天人生，你想和谁交换？',
    '你小时候做过最调皮的事情是什么？',
    '你最想学会但一直没学的技能是什么？',
    '你最近一次撒的小谎是什么？',
    '你手机里最常用的三个 App 是什么？',
    '你最害怕别人发现的小习惯是什么？',
    '如果明天放假一天，你会怎么安排？',
    '你最喜欢自己身上的哪一点？',
    '你做过最冲动的决定是什么？'
  ],
  dare: [
    '用夸张语气自我介绍30秒。',
    '模仿一种动物让大家猜。',
    '对右手边的人说一句土味情话。',
    '用三种表情完成自拍姿势。',
    '唱一句你最近听过的歌。',
    '原地做10个深蹲。',
    '用播音腔读出最近一条非隐私消息。',
    '给大家表演一个无声电影片段。',
    '用反手写下自己的名字。',
    '保持一个搞怪表情10秒。'
  ]
};

function createRoomId() {
  let roomId;
  do {
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms.has(roomId));
  return roomId;
}

function pickPrompt(type) {
  const list = prompts[type];
  return list[Math.floor(Math.random() * list.length)];
}

function createRoom(roomId, hostId, hostName) {
  return {
    id: roomId,
    players: [{
      id: hostId,
      name: hostName,
      isHost: true,
      completed: 0
    }],
    gameStarted: false,
    phase: 'lobby',
    currentPlayerIndex: 0,
    turnNumber: 0,
    currentPrompt: null,
    history: [],
    createdAt: new Date()
  };
}

function getCurrentPlayer(room) {
  return room.players[room.currentPlayerIndex] || null;
}

function getRoomState(room) {
  const currentPlayer = getCurrentPlayer(room);
  return {
    id: room.id,
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      completed: player.completed
    })),
    gameStarted: room.gameStarted,
    phase: room.phase,
    currentPlayer: currentPlayer ? { id: currentPlayer.id, name: currentPlayer.name } : null,
    currentPrompt: room.currentPrompt,
    turnNumber: room.turnNumber,
    history: room.history.slice(-8)
  };
}

function emitRoom(room, namespace, eventName = 'roomState') {
  namespace.to(room.id).emit(eventName, { room: getRoomState(room) });
}

function advanceTurn(room) {
  if (room.players.length === 0) return;

  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  room.turnNumber++;
  room.currentPrompt = null;
  room.phase = 'choosing';
}

function handleDisconnect(socket, namespace) {
  const room = rooms.get(socket.roomId);
  if (!room) return;

  const playerIndex = room.players.findIndex(player => player.id === socket.id);
  if (playerIndex === -1) return;

  const player = room.players[playerIndex];
  const wasCurrentPlayer = playerIndex === room.currentPlayerIndex;
  room.players.splice(playerIndex, 1);

  if (player.isHost && room.players.length > 0) {
    room.players[0].isHost = true;
  }

  if (room.players.length === 0) {
    rooms.delete(socket.roomId);
    return;
  }

  if (room.currentPlayerIndex >= room.players.length) {
    room.currentPlayerIndex = 0;
  } else if (playerIndex < room.currentPlayerIndex) {
    room.currentPlayerIndex--;
  }
  if (room.currentPrompt && wasCurrentPlayer) {
    room.currentPrompt = null;
    room.phase = 'choosing';
  }

  namespace.to(room.id).emit('playerLeft', {
    player: { id: player.id, name: player.name },
    room: getRoomState(room)
  });
}

function handleDisconnectWithGrace(socket, namespace) {
  const room = rooms.get(socket.roomId);
  if (!room) return;

  const playerIndex = room.players.findIndex(player => player.id === socket.id);
  if (playerIndex === -1) return;

  const player = room.players[playerIndex];
  schedulePlayerRemoval(player, () => {
    const currentRoom = rooms.get(socket.roomId);
    if (!currentRoom) return;

    const currentPlayerIndex = currentRoom.players.findIndex(p => p.id === player.id);
    if (currentPlayerIndex === -1) return;

    const wasCurrentPlayer = currentPlayerIndex === currentRoom.currentPlayerIndex;
    currentRoom.players.splice(currentPlayerIndex, 1);

    if (player.isHost && currentRoom.players.length > 0) {
      currentRoom.players[0].isHost = true;
    }

    if (currentRoom.players.length === 0) {
      rooms.delete(socket.roomId);
      return;
    }

    if (currentRoom.currentPlayerIndex >= currentRoom.players.length) {
      currentRoom.currentPlayerIndex = 0;
    } else if (currentPlayerIndex < currentRoom.currentPlayerIndex) {
      currentRoom.currentPlayerIndex--;
    }
    if (currentRoom.currentPrompt && wasCurrentPlayer) {
      currentRoom.currentPrompt = null;
      currentRoom.phase = 'choosing';
    }

    namespace.to(currentRoom.id).emit('playerLeft', {
      player: { id: player.id, name: player.name },
      room: getRoomState(currentRoom)
    });
  });
}

function initSocket(io) {
  const namespace = io.of('/truthordare');

  namespace.on('connection', (socket) => {
    console.log('[真心话大冒险] 用户连接:', socket.id);

    socket.on('createRoom', (playerName) => {
      const roomId = createRoomId();
      const room = createRoom(roomId, socket.id, playerName);

      rooms.set(roomId, room);
      attachSocketToPlayer(socket, roomId, room.players[0]);

      socket.emit('roomCreated', {
        roomId,
        player: room.players[0],
        room: getRoomState(room)
      });
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
      const room = rooms.get(roomId.toUpperCase());
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }
      if (room.players.length >= 12) {
        socket.emit('error', { message: '房间已满（最多12人）' });
        return;
      }

      const player = {
        id: socket.id,
        name: playerName,
        isHost: false,
        completed: 0
      };

      room.players.push(player);
      attachSocketToPlayer(socket, room.id, player);

      socket.emit('roomJoined', {
        roomId: room.id,
        player,
        room: getRoomState(room)
      });
      socket.to(room.id).emit('playerJoined', { player, room: getRoomState(room) });
    });

    socket.on('rejoinRoom', ({ roomId, playerId, playerName }) => {
      const result = rejoinPlayer({
        socket,
        rooms,
        roomId,
        playerId,
        playerName,
        getRoomState,
        onPlayerIdChange: (room, oldId, newId) => {
          if (room.currentPrompt?.playerId === oldId) room.currentPrompt.playerId = newId;
        }
      });

      if (!result) return;
      const { room, player } = result;
      socket.to(room.id).emit('playerRejoined', {
        player: { id: player.id, name: player.name, isHost: player.isHost },
        room: getRoomState(room)
      });
    });

    socket.on('startGame', () => {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: '只有房主可以开始游戏' });
        return;
      }
      if (room.players.length < 2) {
        socket.emit('error', { message: '至少需要2名玩家才能开始' });
        return;
      }

      room.gameStarted = true;
      room.phase = 'choosing';
      room.currentPlayerIndex = 0;
      room.turnNumber = 1;
      room.currentPrompt = null;
      room.players.forEach(p => {
        p.completed = 0;
      });
      room.history = ['游戏开始！轮到第一位玩家选择真心话或大冒险。'];
      emitRoom(room, namespace, 'gameStarted');
    });

    socket.on('choosePrompt', ({ type }) => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'choosing') return;

      const currentPlayer = getCurrentPlayer(room);
      if (currentPlayer?.id !== socket.id) {
        socket.emit('error', { message: '还没轮到你选择' });
        return;
      }

      const promptType = type === 'random'
        ? (Math.random() > 0.5 ? 'truth' : 'dare')
        : type;
      if (!prompts[promptType]) {
        socket.emit('error', { message: '题目类型无效' });
        return;
      }

      room.currentPrompt = {
        type: promptType,
        text: pickPrompt(promptType),
        playerId: currentPlayer.id,
        playerName: currentPlayer.name
      };
      room.phase = 'answering';
      room.history.push(`${currentPlayer.name} 选择了${promptType === 'truth' ? '真心话' : '大冒险'}。`);
      emitRoom(room, namespace, 'promptChosen');
    });

    socket.on('completeTurn', () => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'answering') return;

      const currentPlayer = getCurrentPlayer(room);
      const actor = room.players.find(p => p.id === socket.id);
      if (currentPlayer?.id !== socket.id && !actor?.isHost) {
        socket.emit('error', { message: '只有当前玩家或房主可以结束本轮' });
        return;
      }

      if (currentPlayer) {
        currentPlayer.completed++;
        room.history.push(`${currentPlayer.name} 完成了挑战。`);
      }
      advanceTurn(room);
      emitRoom(room, namespace, 'turnCompleted');
    });

    socket.on('skipTurn', () => {
      const room = rooms.get(socket.roomId);
      if (!room || !room.gameStarted) return;

      const actor = room.players.find(p => p.id === socket.id);
      if (!actor?.isHost) {
        socket.emit('error', { message: '只有房主可以跳过回合' });
        return;
      }

      const currentPlayer = getCurrentPlayer(room);
      if (currentPlayer) {
        room.history.push(`${currentPlayer.name} 的回合被跳过。`);
      }
      advanceTurn(room);
      emitRoom(room, namespace, 'turnCompleted');
    });

    socket.on('disconnect', () => {
      console.log('[真心话大冒险] 用户断开:', socket.id);
      handleDisconnectWithGrace(socket, namespace);
    });
  });
}

module.exports = { initSocket };
