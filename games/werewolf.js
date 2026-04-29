// 狼人杀（简化版）
const rooms = new Map();
const {
  attachSocketToPlayer,
  schedulePlayerRemoval,
  replaceIdInVotes,
  rejoinPlayer
} = require('./reconnect');

const roleNames = {
  wolf: '狼人',
  seer: '预言家',
  witch: '女巫',
  villager: '村民'
};

function createRoomId() {
  let roomId;
  do {
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms.has(roomId));
  return roomId;
}

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createRoom(roomId, hostId, hostName) {
  return {
    id: roomId,
    players: [{
      id: hostId,
      name: hostName,
      isHost: true,
      alive: true,
      role: null,
      hasVoted: false
    }],
    gameStarted: false,
    phase: 'lobby',
    dayNumber: 0,
    votes: {},
    nightActions: {},
    witchSaveUsed: false,
    witchPoisonUsed: false,
    winner: null,
    history: [],
    createdAt: new Date()
  };
}

function getAlivePlayers(room) {
  return room.players.filter(player => player.alive);
}

function getAliveWolves(room) {
  return room.players.filter(player => player.alive && player.role === 'wolf');
}

function getRoomState(room, forPlayerId = null) {
  const viewer = room.players.find(player => player.id === forPlayerId);
  const showRoles = room.phase === 'ended';
  const voteCounts = Object.values(room.votes).reduce((counts, targetId) => {
    counts[targetId] = (counts[targetId] || 0) + 1;
    return counts;
  }, {});
  const wolfTarget = room.nightActions.wolfTarget
    ? room.players.find(player => player.id === room.nightActions.wolfTarget)
    : null;

  return {
    id: room.id,
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      alive: player.alive,
      hasVoted: player.hasVoted,
      votesReceived: voteCounts[player.id] || 0,
      role: showRoles || player.id === forPlayerId ? player.role : null,
      roleName: showRoles || player.id === forPlayerId ? roleNames[player.role] : null
    })),
    gameStarted: room.gameStarted,
    phase: room.phase,
    dayNumber: room.dayNumber,
    myRole: viewer?.role || null,
    myRoleName: viewer?.role ? roleNames[viewer.role] : null,
    wolfTeammates: viewer?.role === 'wolf'
      ? room.players.filter(player => player.role === 'wolf').map(player => ({ id: player.id, name: player.name, alive: player.alive }))
      : [],
    witch: viewer?.role === 'witch' ? {
      saveUsed: room.witchSaveUsed,
      poisonUsed: room.witchPoisonUsed,
      nightVictim: wolfTarget ? { id: wolfTarget.id, name: wolfTarget.name } : null
    } : null,
    winner: room.winner,
    history: room.history.slice(-10)
  };
}

function emitRoom(room, namespace, eventName = 'roomState') {
  room.players.forEach(player => {
    namespace.to(player.id).emit(eventName, { room: getRoomState(room, player.id) });
  });
}

function assignRoles(room) {
  const playerCount = room.players.length;
  const wolfCount = playerCount >= 7 ? 2 : 1;
  const roles = [];

  for (let i = 0; i < wolfCount; i++) roles.push('wolf');
  roles.push('seer');
  if (playerCount >= 6) roles.push('witch');
  while (roles.length < playerCount) roles.push('villager');

  const shuffledRoles = shuffle(roles);
  room.players.forEach((player, index) => {
    player.alive = true;
    player.role = shuffledRoles[index];
    player.hasVoted = false;
  });

  room.gameStarted = true;
  room.phase = 'night';
  room.dayNumber = 1;
  room.votes = {};
  room.nightActions = {};
  room.witchSaveUsed = false;
  room.witchPoisonUsed = false;
  room.winner = null;
  room.history = ['天黑请闭眼，狼人、预言家、女巫依次行动。'];
}

function checkWinner(room) {
  const alivePlayers = getAlivePlayers(room);
  const wolves = alivePlayers.filter(player => player.role === 'wolf').length;
  const good = alivePlayers.length - wolves;

  if (wolves === 0) {
    room.winner = 'good';
    room.phase = 'ended';
    room.gameStarted = false;
    room.history.push('好人阵营获胜！');
    return true;
  }

  if (wolves >= good) {
    room.winner = 'wolf';
    room.phase = 'ended';
    room.gameStarted = false;
    room.history.push('狼人阵营获胜！');
    return true;
  }

  return false;
}

function resolveNight(room) {
  const eliminated = [];
  const wolfTarget = room.players.find(player => player.id === room.nightActions.wolfTarget && player.alive);
  const poisonTarget = room.players.find(player => player.id === room.nightActions.poisonTarget && player.alive);
  const saved = room.nightActions.saveTarget && room.nightActions.saveTarget === wolfTarget?.id;

  if (wolfTarget && !saved) {
    wolfTarget.alive = false;
    eliminated.push(wolfTarget.name);
  }

  if (poisonTarget && poisonTarget.alive) {
    poisonTarget.alive = false;
    eliminated.push(poisonTarget.name);
  }

  if (eliminated.length === 0) {
    room.history.push('昨晚是平安夜。');
  } else {
    room.history.push(`昨晚 ${eliminated.join('、')} 出局。`);
  }

  room.nightActions = {};
  if (!checkWinner(room)) {
    room.phase = 'day';
    room.history.push('天亮了，开始发言讨论。');
  }
}

function resolveVotes(room) {
  const voteCounts = Object.values(room.votes).reduce((counts, targetId) => {
    counts[targetId] = (counts[targetId] || 0) + 1;
    return counts;
  }, {});
  const entries = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    room.history.push('无人投票，直接进入夜晚。');
  } else {
    const [topId, topVotes] = entries[0];
    const tied = entries.filter(([, votes]) => votes === topVotes);
    if (tied.length > 1) {
      room.history.push('投票平票，无人放逐。');
    } else {
      const eliminated = room.players.find(player => player.id === topId);
      if (eliminated?.alive) {
        eliminated.alive = false;
        room.history.push(`${eliminated.name} 被放逐，身份是 ${roleNames[eliminated.role]}。`);
      }
    }
  }

  room.votes = {};
  room.players.forEach(player => {
    player.hasVoted = false;
  });

  if (!checkWinner(room)) {
    room.dayNumber++;
    room.phase = 'night';
    room.nightActions = {};
    room.history.push(`第 ${room.dayNumber} 夜开始。`);
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

  delete room.votes[player.id];
  Object.keys(room.votes).forEach(voterId => {
    if (room.votes[voterId] === player.id) delete room.votes[voterId];
  });

  if (room.gameStarted) checkWinner(room);

  room.players.forEach(p => {
    namespace.to(p.id).emit('playerLeft', {
      player: { id: player.id, name: player.name },
      room: getRoomState(room, p.id)
    });
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

    delete currentRoom.votes[player.id];
    Object.keys(currentRoom.votes).forEach(voterId => {
      if (currentRoom.votes[voterId] === player.id) delete currentRoom.votes[voterId];
    });

    if (currentRoom.gameStarted) checkWinner(currentRoom);

    currentRoom.players.forEach(p => {
      namespace.to(p.id).emit('playerLeft', {
        player: { id: player.id, name: player.name },
        room: getRoomState(currentRoom, p.id)
      });
    });
  });
}

function initSocket(io) {
  const namespace = io.of('/werewolf');

  namespace.on('connection', (socket) => {
    console.log('[狼人杀] 用户连接:', socket.id);

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
      if (room.gameStarted) {
        socket.emit('error', { message: '游戏已经开始，无法加入' });
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
        alive: true,
        role: null,
        hasVoted: false
      };

      room.players.push(player);
      attachSocketToPlayer(socket, room.id, player);

      socket.emit('roomJoined', {
        roomId: room.id,
        player,
        room: getRoomState(room, socket.id)
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
          replaceIdInVotes(room.votes, oldId, newId);
          ['wolfTarget', 'poisonTarget', 'saveTarget'].forEach(key => {
            if (room.nightActions[key] === oldId) room.nightActions[key] = newId;
          });
        }
      });

      if (!result) return;
      const { room, player } = result;
      room.players.forEach(p => {
        if (p.id !== player.id) {
          namespace.to(p.id).emit('playerRejoined', {
            player: { id: player.id, name: player.name, isHost: player.isHost },
            room: getRoomState(room, p.id)
          });
        }
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
      if (room.players.length < 4) {
        socket.emit('error', { message: '至少需要4名玩家才能开始' });
        return;
      }

      assignRoles(room);
      emitRoom(room, namespace, 'gameStarted');
    });

    socket.on('wolfKill', ({ targetPlayerId }) => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'night') return;

      const player = room.players.find(p => p.id === socket.id);
      const target = room.players.find(p => p.id === targetPlayerId);
      if (!player?.alive || player.role !== 'wolf') {
        socket.emit('error', { message: '只有存活狼人可以选择袭击目标' });
        return;
      }
      if (!target?.alive || target.role === 'wolf') {
        socket.emit('error', { message: '请选择一名非狼人存活玩家' });
        return;
      }

      room.nightActions.wolfTarget = target.id;
      room.history.push('狼人已选择目标。');
      emitRoom(room, namespace, 'roomState');
    });

    socket.on('seerCheck', ({ targetPlayerId }) => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'night') return;

      const player = room.players.find(p => p.id === socket.id);
      const target = room.players.find(p => p.id === targetPlayerId);
      if (!player?.alive || player.role !== 'seer') {
        socket.emit('error', { message: '只有存活预言家可以查验' });
        return;
      }
      if (!target) {
        socket.emit('error', { message: '查验目标不存在' });
        return;
      }
      if (room.nightActions.seerChecked) {
        socket.emit('error', { message: '今晚已经查验过了' });
        return;
      }

      room.nightActions.seerChecked = true;
      socket.emit('seerResult', {
        target: { id: target.id, name: target.name },
        isWolf: target.role === 'wolf'
      });
      emitRoom(room, namespace, 'roomState');
    });

    socket.on('witchSave', ({ targetPlayerId }) => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'night') return;

      const player = room.players.find(p => p.id === socket.id);
      const target = room.players.find(p => p.id === targetPlayerId);
      if (!player?.alive || player.role !== 'witch') {
        socket.emit('error', { message: '只有存活女巫可以使用解药' });
        return;
      }
      if (room.witchSaveUsed) {
        socket.emit('error', { message: '解药已经用过了' });
        return;
      }
      if (!target?.alive) {
        socket.emit('error', { message: '请选择一名存活玩家' });
        return;
      }

      room.nightActions.saveTarget = target.id;
      room.witchSaveUsed = true;
      room.history.push('女巫已使用解药。');
      emitRoom(room, namespace, 'roomState');
    });

    socket.on('witchPoison', ({ targetPlayerId }) => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'night') return;

      const player = room.players.find(p => p.id === socket.id);
      const target = room.players.find(p => p.id === targetPlayerId);
      if (!player?.alive || player.role !== 'witch') {
        socket.emit('error', { message: '只有存活女巫可以使用毒药' });
        return;
      }
      if (room.witchPoisonUsed) {
        socket.emit('error', { message: '毒药已经用过了' });
        return;
      }
      if (!target?.alive || target.id === player.id) {
        socket.emit('error', { message: '请选择其他存活玩家' });
        return;
      }

      room.nightActions.poisonTarget = target.id;
      room.witchPoisonUsed = true;
      room.history.push('女巫已使用毒药。');
      emitRoom(room, namespace, 'roomState');
    });

    socket.on('finishNight', () => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'night') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: '只有房主可以结束夜晚' });
        return;
      }

      resolveNight(room);
      emitRoom(room, namespace, 'nightResolved');
    });

    socket.on('startVoting', () => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'day') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: '只有房主可以发起投票' });
        return;
      }

      room.phase = 'voting';
      room.votes = {};
      room.players.forEach(p => {
        p.hasVoted = false;
      });
      room.history.push('白天投票开始。');
      emitRoom(room, namespace, 'votingStarted');
    });

    socket.on('votePlayer', ({ targetPlayerId }) => {
      const room = rooms.get(socket.roomId);
      if (!room || room.phase !== 'voting') return;

      const voter = room.players.find(p => p.id === socket.id);
      const target = room.players.find(p => p.id === targetPlayerId);
      if (!voter?.alive || !target?.alive) {
        socket.emit('error', { message: '只能由存活玩家投给存活玩家' });
        return;
      }
      if (voter.hasVoted) {
        socket.emit('error', { message: '你已经投过票了' });
        return;
      }

      room.votes[voter.id] = target.id;
      voter.hasVoted = true;

      if (getAlivePlayers(room).every(player => player.hasVoted)) {
        resolveVotes(room);
        emitRoom(room, namespace, 'voteResolved');
      } else {
        emitRoom(room, namespace, 'roomState');
      }
    });

    socket.on('restartGame', () => {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: '只有房主可以重新开始' });
        return;
      }

      assignRoles(room);
      emitRoom(room, namespace, 'gameStarted');
    });

    socket.on('disconnect', () => {
      console.log('[狼人杀] 用户断开:', socket.id);
      handleDisconnectWithGrace(socket, namespace);
    });
  });
}

module.exports = { initSocket };
