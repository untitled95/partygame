(function () {
  const PREFIX = 'partygame:session:';

  function storageKey(gameKey) {
    return `${PREFIX}${gameKey}`;
  }

  function load(gameKey) {
    try {
      return JSON.parse(localStorage.getItem(storageKey(gameKey)) || 'null');
    } catch {
      return null;
    }
  }

  function save(gameKey, roomId, player) {
    if (!roomId || !player?.id || !player?.name) return;
    localStorage.setItem(storageKey(gameKey), JSON.stringify({
      roomId,
      playerId: player.id,
      playerName: player.name
    }));
  }

  function clear(gameKey) {
    localStorage.removeItem(storageKey(gameKey));
  }

  function setup(gameKey, socket, options = {}) {
    const hasActiveSession = options.hasActiveSession || (() => false);

    function tryRejoin() {
      if (hasActiveSession()) return;
      const session = load(gameKey);
      if (!session?.roomId || !session?.playerId || !session?.playerName) return;
      socket.emit('rejoinRoom', session);
    }

    socket.on('connect', tryRejoin);
    socket.on('roomCreated', (data) => save(gameKey, data.roomId || data.room?.id, data.player));
    socket.on('roomJoined', (data) => save(gameKey, data.roomId || data.room?.id, data.player));
    socket.on('roomRejoined', (data) => {
      save(gameKey, data.roomId || data.room?.id, data.player);
      if (options.onRejoined) options.onRejoined(data);
    });
    socket.on('rejoinFailed', () => clear(gameKey));
    if (socket.connected) setTimeout(tryRejoin, 0);

    return { load: () => load(gameKey), save: (roomId, player) => save(gameKey, roomId, player), clear, tryRejoin };
  }

  window.PartySession = { setup, load, save, clear };
})();
