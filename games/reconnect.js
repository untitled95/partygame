const RECONNECT_GRACE_MS = 30000;

function attachSocketToPlayer(socket, roomId, player) {
  if (player.disconnectTimer) {
    clearTimeout(player.disconnectTimer);
    delete player.disconnectTimer;
  }

  player.connected = true;
  socket.roomId = roomId;
  socket.join(roomId);
}

function schedulePlayerRemoval(player, removePlayer) {
  if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
  player.connected = false;
  player.disconnectTimer = setTimeout(() => {
    if (player.connected) return;
    removePlayer();
  }, RECONNECT_GRACE_MS);
}

function replaceIdInArray(items, oldId, newId) {
  if (!Array.isArray(items)) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i] === oldId) items[i] = newId;
  }
}

function replaceIdInVotes(votes, oldId, newId) {
  if (!votes) return;

  if (Object.prototype.hasOwnProperty.call(votes, oldId)) {
    votes[newId] = votes[oldId];
    delete votes[oldId];
  }

  Object.keys(votes).forEach(voterId => {
    if (votes[voterId] === oldId) votes[voterId] = newId;
  });
}

function rejoinPlayer({
  socket,
  rooms,
  roomId,
  playerId,
  playerName,
  getRoomState,
  onPlayerIdChange,
  eventName = 'roomRejoined'
}) {
  const normalizedRoomId = String(roomId || '').trim().toUpperCase();
  const room = rooms.get(normalizedRoomId);

  if (!room) {
    socket.emit('rejoinFailed', { message: '房间不存在或已结束' });
    return null;
  }

  const player = room.players.find(p => p.id === playerId)
    || room.players.find(p => !p.connected && p.name === playerName);

  if (!player) {
    socket.emit('rejoinFailed', { message: '未找到可恢复的玩家' });
    return null;
  }

  const oldId = player.id;
  if (oldId !== socket.id) {
    player.id = socket.id;
    if (onPlayerIdChange) onPlayerIdChange(room, oldId, socket.id, player);
  }

  attachSocketToPlayer(socket, room.id, player);
  socket.emit(eventName, {
    roomId: room.id,
    player,
    room: getRoomState(room, socket.id)
  });

  return { room, player, oldId };
}

module.exports = {
  attachSocketToPlayer,
  schedulePlayerRemoval,
  replaceIdInArray,
  replaceIdInVotes,
  rejoinPlayer
};
