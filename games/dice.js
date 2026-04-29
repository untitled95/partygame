// 骰子游戏
const rooms = new Map();
const {
  attachSocketToPlayer,
  schedulePlayerRemoval,
  rejoinPlayer
} = require('./reconnect');

function createRoomId() {
  let roomId;
  do {
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms.has(roomId));
  return roomId;
}

function createRoom(roomId, hostId, hostName) {
  return {
    id: roomId,
    players: [{
      id: hostId,
      name: hostName,
      isHost: true,
      score: 0,
      lastRoll: null,
      hasRolled: false
    }],
    gameStarted: false,
    phase: 'lobby',
    roundNumber: 0,
    totalRounds: 5,
    diceCount: 2,
    sides: 6,
    roundWinners: [],
    history: [],
    createdAt: new Date()
  };
}

function getRoomState(room) {
  return {
    id: room.id,
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      score: player.score,
      lastRoll: player.lastRoll,
      hasRolled: player.hasRolled
    })),
    gameStarted: room.gameStarted,
    phase: room.phase,
    roundNumber: room.roundNumber,
    totalRounds: room.totalRounds,
    diceCount: room.diceCount,
    sides: room.sides,
    roundWinners: room.roundWinners,
    history: room.history.slice(-8)
  };
}

function emitRoom(room, namespace, eventName = 'roomState') {
  namespace.to(room.id).emit(eventName, { room: getRoomState(room) });
}

function rollDice(count, sides) {
  const values = [];
  for (let i = 0; i < count; i++) {
    values.push(Math.floor(Math.random() * sides) + 1);
  }
  return {
    values,
    total: values.reduce((sum, value) => sum + value, 0)
  };
}

function startRound(room) {
  room.phase = 'rolling';
  room.roundWinners = [];
  room.players.forEach(player => {
    player.lastRoll = null;
    player.hasRolled = false;
  });
  room.history.push(`第 ${room.roundNumber} 轮开始，大家开始摇骰子。`);
}

function resolveRound(room) {
  const topTotal = Math.max(...room.players.map(player => player.lastRoll.total));
  const winners = room.players.filter(player => player.lastRoll.total === topTotal);

  winners.forEach(player => {
    player.score += 1;
  });

  room.roundWinners = winners.map(player => ({ id: player.id, name: player.name, total: topTotal }));
  room.history.push(`${winners.map(player => player.name).join('、')} 本轮最高点数 ${topTotal}，获得1分。`);

  if (room.roundNumber >= room.totalRounds) {
    room.phase = 'ended';
    room.gameStarted = false;
    room.history.push('游戏结束！');
  } else {
    room.phase = 'roundResult';
  }
}

function handleDisconnect(socket, namespace) {
  const room = rooms.get(socket.roomId);
  if (!room) return;

  const playerIndex = room.players.findIndex(player => player.id === socket.id);
  if (playerIndex === -1) return;

  const player = room.players[playerIndex];
  room.players.splice(playerIndex, 1);

  if (player.isHost && room.players.length > 0) {
    room.players[0].isHost = true;
  }

  if (room.players.length === 0) {
    rooms.delete(socket.roomId);
    return;
  }

  if (room.phase === 'rolling' && room.players.every(p => p.hasRolled)) {
    resolveRound(room);
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

    currentRoom.players.splice(currentPlayerIndex, 1);

    if (player.isHost && currentRoom.players.length > 0) {
      currentRoom.players[0].isHost = true;
    }

    if (currentRoom.players.length === 0) {
      rooms.delete(socket.roomId);
      return;
    }

    if (currentRoom.phase === 'rolling' && currentRoom.players.every(p => p.hasRolled)) {
      resolveRound(currentRoom);
    }

    namespace.to(currentRoom.id).emit('playerLeft', {
      player: { id: player.id, name: player.name },
      room: getRoomState(currentRoom)
    });
  });
}

function initSocket(io) {
  const namespace = io.of('/dice');

  namespace.on('connection', (socket) => {
    console.log('[骰子游戏] 用户连接:', socket.id);

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
      if (room.gameStarted) {
        socket.emit('error', { message: '游戏已经开始，无法加入' });
        return;
      }
      if (room.players.length >= 8) {
        socket.emit('error', { message: '房间已满（最多8人）' });
        return;
      }

      const player = {
        id: socket.id,
        name: playerName,
        isHost: false,
        score: 0,
        lastRoll: null,
        hasRolled: false
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
          room.roundWinners.forEach(winner => {
            if (winner.id === oldId) winner.id = newId;
          });
        }
      });

      if (!result) return;
      const { room, player } = result;
      socket.to(room.id).emit('playerRejoined', {
        player: { id: player.id, name: player.name, isHost: player.isHost },
        room: getRoomState(room)
      });
    });

    socket.on('startGame', (settings = {}) => {
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

      room.totalRounds = Math.min(Math.max(parseInt(settings.totalRounds, 10) || 5, 1), 10);
      room.diceCount = Math.min(Math.max(parseInt(settings.diceCount, 10) || 2, 1), 5);
      room.sides = 6;
      room.roundNumber = 1;
      room.gameStarted = true;
      room.players.forEach(p => {
        p.score = 0;
      });
      room.history = [];
      startRound(room);
      emitRoom(room, namespace, 'gameStarted');
    });

    socket.on('rollDice', () => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'rolling') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      if (player.hasRolled) {
        socket.emit('error', { message: '本轮你已经摇过了' });
        return;
      }

      player.lastRoll = rollDice(room.diceCount, room.sides);
      player.hasRolled = true;
      room.history.push(`${player.name} 摇出了 ${player.lastRoll.total} 点。`);

      if (room.players.every(p => p.hasRolled)) {
        resolveRound(room);
        emitRoom(room, namespace, 'roundResolved');
      } else {
        emitRoom(room, namespace, 'rollMade');
      }
    });

    socket.on('nextRound', () => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'roundResult') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: '只有房主可以开始下一轮' });
        return;
      }

      room.roundNumber++;
      startRound(room);
      emitRoom(room, namespace, 'newRound');
    });

    socket.on('restartGame', () => {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: '只有房主可以重新开始' });
        return;
      }

      room.roundNumber = 1;
      room.gameStarted = true;
      room.players.forEach(p => {
        p.score = 0;
      });
      room.history = [];
      startRound(room);
      emitRoom(room, namespace, 'gameStarted');
    });

    socket.on('disconnect', () => {
      console.log('[骰子游戏] 用户断开:', socket.id);
      handleDisconnectWithGrace(socket, namespace);
    });
  });
}

module.exports = { initSocket };
