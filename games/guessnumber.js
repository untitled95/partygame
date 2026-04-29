// 猜数字（几A几B）
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

function createPlayer(socketId, playerName, isHost = false) {
  return {
    id: socketId,
    name: playerName,
    isHost,
    score: 0,
    secret: null,
    ready: false
  };
}

function createRoom(roomId, hostId, hostName) {
  return {
    id: roomId,
    players: [createPlayer(hostId, hostName, true)],
    gameStarted: false,
    phase: 'lobby',
    currentPlayerIndex: 0,
    turnNumber: 0,
    winner: null,
    history: [],
    createdAt: new Date()
  };
}

function isValidNumber(value) {
  return /^\d{4}$/.test(value) && new Set(value).size === 4;
}

function getOpponent(room, playerId) {
  return room.players.find(player => player.id !== playerId) || null;
}

function calculateHint(guess, secret) {
  let a = 0;
  let b = 0;

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) {
      a++;
    } else if (secret.includes(guess[i])) {
      b++;
    }
  }

  return { a, b };
}

function getRoomState(room, forPlayerId = null) {
  const currentPlayer = room.players[room.currentPlayerIndex] || null;
  const showSecrets = room.phase === 'ended';

  return {
    id: room.id,
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      score: player.score,
      ready: player.ready,
      secret: showSecrets || player.id === forPlayerId ? player.secret : null
    })),
    gameStarted: room.gameStarted,
    phase: room.phase,
    currentPlayer: currentPlayer ? { id: currentPlayer.id, name: currentPlayer.name } : null,
    turnNumber: room.turnNumber,
    winner: room.winner,
    history: room.history.slice(-20)
  };
}

function emitRoom(room, namespace, eventName = 'roomState') {
  room.players.forEach(player => {
    namespace.to(player.id).emit(eventName, { room: getRoomState(room, player.id) });
  });
}

function resetRound(room) {
  room.gameStarted = true;
  room.phase = 'setSecret';
  room.currentPlayerIndex = 0;
  room.turnNumber = 1;
  room.winner = null;
  room.history = ['游戏开始！双方请输入自己的4位不重复数字。'];
  room.players.forEach(player => {
    player.secret = null;
    player.ready = false;
  });
}

function handleDisconnect(socket, namespace) {
  const room = rooms.get(socket.roomId);
  if (!room) return;

  const playerIndex = room.players.findIndex(player => player.id === socket.id);
  if (playerIndex === -1) return;

  const player = room.players[playerIndex];
  room.players.splice(playerIndex, 1);

  if (room.players.length === 0) {
    rooms.delete(socket.roomId);
    return;
  }

  room.players[0].isHost = true;
  room.gameStarted = false;
  room.phase = 'lobby';
  room.currentPlayerIndex = 0;
  room.turnNumber = 0;
  room.winner = null;
  room.history.push(`${player.name} 离开了房间，游戏已回到等待室。`);
  room.players.forEach(p => {
    p.secret = null;
    p.ready = false;
  });

  namespace.to(room.id).emit('playerLeft', {
    player: { id: player.id, name: player.name },
    room: getRoomState(room, room.players[0].id)
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

    if (currentRoom.players.length === 0) {
      rooms.delete(socket.roomId);
      return;
    }

    currentRoom.players[0].isHost = true;
    currentRoom.gameStarted = false;
    currentRoom.phase = 'lobby';
    currentRoom.currentPlayerIndex = 0;
    currentRoom.turnNumber = 0;
    currentRoom.winner = null;
    currentRoom.history.push(`${player.name} 离开了房间，游戏已回到等待室。`);
    currentRoom.players.forEach(p => {
      p.secret = null;
      p.ready = false;
    });

    namespace.to(currentRoom.id).emit('playerLeft', {
      player: { id: player.id, name: player.name },
      room: getRoomState(currentRoom, currentRoom.players[0].id)
    });
  });
}

function initSocket(io) {
  const namespace = io.of('/guessnumber');

  namespace.on('connection', (socket) => {
    console.log('[猜数字] 用户连接:', socket.id);

    socket.on('createRoom', (playerName) => {
      const roomId = createRoomId();
      const room = createRoom(roomId, socket.id, playerName);

      rooms.set(roomId, room);
      attachSocketToPlayer(socket, roomId, room.players[0]);

      socket.emit('roomCreated', {
        roomId,
        player: room.players[0],
        room: getRoomState(room, socket.id)
      });
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
      const room = rooms.get(roomId.toUpperCase());
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }
      if (room.players.length >= 2) {
        socket.emit('error', { message: '猜数字只支持2人对战' });
        return;
      }
      if (room.gameStarted) {
        socket.emit('error', { message: '游戏已经开始，无法加入' });
        return;
      }

      const player = createPlayer(socket.id, playerName, false);
      room.players.push(player);
      attachSocketToPlayer(socket, room.id, player);

      socket.emit('roomJoined', {
        roomId: room.id,
        player,
        room: getRoomState(room, socket.id)
      });

      socket.to(room.id).emit('playerJoined', {
        player,
        room: getRoomState(room)
      });
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
          if (room.winner?.id === oldId) room.winner.id = newId;
        }
      });

      if (!result) return;
      const { room, player } = result;
      socket.to(room.id).emit('playerRejoined', {
        player: { id: player.id, name: player.name, isHost: player.isHost },
        room: getRoomState(room, player.id)
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
      if (room.players.length !== 2) {
        socket.emit('error', { message: '需要2名玩家才能开始' });
        return;
      }

      resetRound(room);
      emitRoom(room, namespace, 'gameStarted');
    });

    socket.on('setSecret', ({ secret }) => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'setSecret') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      const normalized = String(secret || '').trim();
      if (!isValidNumber(normalized)) {
        socket.emit('error', { message: '请输入4位不重复数字，例如 1234' });
        return;
      }

      player.secret = normalized;
      player.ready = true;
      room.history.push(`${player.name} 已设置秘密数字。`);

      if (room.players.length === 2 && room.players.every(p => p.ready)) {
        room.phase = 'playing';
        room.history.push(`双方准备完成，${room.players[room.currentPlayerIndex].name} 先猜。`);
        emitRoom(room, namespace, 'secretsReady');
      } else {
        emitRoom(room, namespace, 'secretSet');
      }
    });

    socket.on('makeGuess', ({ guess }) => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'playing') return;

      const player = room.players.find(p => p.id === socket.id);
      const currentPlayer = room.players[room.currentPlayerIndex];
      if (!player || currentPlayer?.id !== player.id) {
        socket.emit('error', { message: '还没轮到你猜' });
        return;
      }

      const normalized = String(guess || '').trim();
      if (!isValidNumber(normalized)) {
        socket.emit('error', { message: '请输入4位不重复数字，例如 5678' });
        return;
      }

      const opponent = getOpponent(room, player.id);
      if (!opponent?.secret) {
        socket.emit('error', { message: '对手还没有设置秘密数字' });
        return;
      }

      const hint = calculateHint(normalized, opponent.secret);
      room.history.push(`${player.name} 猜 ${normalized}：${hint.a}A${hint.b}B`);

      if (hint.a === 4) {
        player.score += 1;
        room.phase = 'ended';
        room.gameStarted = false;
        room.winner = { id: player.id, name: player.name };
        room.history.push(`${player.name} 猜中了！本局获胜。`);
        emitRoom(room, namespace, 'gameEnded');
        return;
      }

      room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
      room.turnNumber++;
      emitRoom(room, namespace, 'guessMade');
    });

    socket.on('restartGame', () => {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: '只有房主可以再来一局' });
        return;
      }
      if (room.players.length !== 2) {
        socket.emit('error', { message: '需要2名玩家才能开始' });
        return;
      }

      resetRound(room);
      emitRoom(room, namespace, 'gameStarted');
    });

    socket.on('disconnect', () => {
      console.log('[猜数字] 用户断开:', socket.id);
      handleDisconnectWithGrace(socket, namespace);
    });
  });
}

module.exports = { initSocket };
