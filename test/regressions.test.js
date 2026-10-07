const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function clock() {
  let now = 0;
  let id = 0;
  const jobs = new Map();
  const add = (fn, delay, interval = false) => {
    jobs.set(++id, { fn, at: now + delay, delay, interval });
    return id;
  };
  return {
    setTimeout: (fn, delay) => add(fn, delay),
    setInterval: (fn, delay) => add(fn, delay, true),
    clearTimeout: id => jobs.delete(id),
    clearInterval: id => jobs.delete(id),
    tick(ms) {
      const end = now + ms;
      while (true) {
        const next = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [jobId, job] = next;
        now = job.at;
        if (job.interval) job.at += job.delay;
        else jobs.delete(jobId);
        job.fn();
      }
      now = end;
    }
  };
}

function harness(game) {
  const timers = clock();
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const module = { exports: {} };
    modules.set(filename, module.exports);
    const requireFromFile = createRequire(filename);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      module, exports: module.exports, __dirname: path.dirname(filename),
      require: name => name.startsWith('.') ? load(requireFromFile.resolve(name)) : requireFromFile(name),
      console: { log() {}, error() {} }, ...timers
    }, { filename });
    modules.set(filename, module.exports);
    return module.exports;
  }
  const sockets = [];
  let onConnection;
  const broadcast = (target, excluded) => ({
    emit(event, data) {
      sockets.filter(s => s !== excluded && s.rooms.has(target)).forEach(s => s.emit(event, data));
    }
  });
  const namespace = { on: (_, fn) => { onConnection = fn; }, to: target => broadcast(target) };
  load(path.resolve(__dirname, `../games/${game}.js`)).initSocket({ of: () => namespace });
  function connect(id) {
    const handlers = new Map();
    const socket = {
      id, rooms: new Set([id]), events: [],
      on: (event, fn) => handlers.set(event, fn),
      emit(event, data) { this.events.push({ event, data: JSON.parse(JSON.stringify(data ?? null)) }); },
      join(roomId) { this.rooms.add(roomId); },
      to: target => broadcast(target, socket),
      send(event, data) { handlers.get(event)(data); },
      last(event) { return this.events.filter(item => item.event === event).at(-1)?.data; },
      disconnect() { this.rooms.clear(); this.send('disconnect'); }
    };
    sockets.push(socket);
    onConnection(socket);
    return socket;
  }
  function room(count) {
    const players = Array.from({ length: count }, (_, i) => connect(`p${i}`));
    players[0].send('createRoom', 'Player 0');
    const roomId = players[0].last('roomCreated').roomId;
    players.slice(1).forEach((s, i) => s.send('joinRoom', { roomId, playerName: `Player ${i + 1}` }));
    return { players, roomId };
  }
  return { ...timers, connect, room };
}

test('drawing timeout advances exactly once and rejects guesses after reveal', () => {
  const h = harness('drawguess');
  const { players: [host, guest] } = h.room(2);
  host.send('startGame');
  h.tick(60000);
  guest.send('guess', host.last('timeUp').word);
  assert.equal(guest.last('correctGuess'), undefined);
  h.tick(5000);
  assert.equal(host.events.filter(e => e.event === 'timeUp').length, 1);
  assert.equal(host.events.filter(e => e.event === 'newRound').length, 1);
  assert.equal(host.last('newRound').room.currentDrawer.id, guest.id);
});

test('last-second correct guess cannot schedule a second round transition', () => {
  const h = harness('drawguess');
  const { players: [host, guest] } = h.room(2);
  host.send('startGame');
  h.tick(59000);
  guest.send('guess', host.last('gameStarted').room.currentWord);
  h.tick(6000);
  assert.equal(host.events.filter(e => e.event === 'newRound').length, 1);
  assert.equal(host.events.filter(e => e.event === 'timeUp').length, 0);
});

test('departing drawer hands the turn to the immediate next player', () => {
  const h = harness('drawguess');
  const { players: [host, next, last] } = h.room(3);
  host.send('startGame');
  host.disconnect();
  h.tick(30000);
  assert.equal(next.last('newRound').room.currentDrawer.id, next.id);
  assert.equal(last.last('newRound').room.roundNumber, 1);
});

test('departing final drawer wraps to the host in the next round', () => {
  const h = harness('drawguess');
  const { players: [host, middle, last] } = h.room(3);
  host.send('startGame');
  h.tick(126000);
  assert.equal(host.last('newRound').room.currentDrawer.id, last.id);
  last.disconnect();
  h.tick(30000);
  assert.equal(middle.last('newRound').room.currentDrawer.id, host.id);
  assert.equal(middle.last('newRound').room.roundNumber, 2);
});

test('drawing game ends with one remaining player and cancels timers', () => {
  const h = harness('drawguess');
  const { players: [host, guest] } = h.room(2);
  host.send('startGame');
  guest.disconnect();
  h.tick(30000);
  assert.equal(host.last('gameEnded').room.gameStarted, false);
  h.tick(90000);
  assert.equal(host.events.filter(e => e.event === 'newRound').length, 0);
  assert.equal(host.events.filter(e => e.event === 'timeUp').length, 0);
});

test('drawing game completes all configured turns without extra transitions', () => {
  const h = harness('drawguess');
  const { players: [host] } = h.room(2);
  host.send('startGame');
  h.tick(6 * 63000 + 10000);
  assert.equal(host.events.filter(e => e.event === 'newRound').length, 5);
  assert.equal(host.events.filter(e => e.event === 'timeUp').length, 6);
  assert.equal(host.events.filter(e => e.event === 'gameEnded').length, 1);
});

test('finishing a round while another player disconnects emits serializable rankings', () => {
  const h = harness('drawguess');
  const { players: [host, guest] } = h.room(2);
  host.send('startGame');
  h.tick(5 * 63000 + 59000);
  guest.disconnect();
  h.tick(4000);
  const result = host.last('gameEnded');
  assert.equal(result.room.gameStarted, false);
  assert.equal(result.rankings.length, 2);
  assert.equal(Object.hasOwn(result.rankings[1], 'disconnectTimer'), false);
});

test('guess-number reconnect preserves recipient privacy and own secret', () => {
  const h = harness('guessnumber');
  const { players: [host, guest], roomId } = h.room(2);
  host.send('startGame');
  host.send('setSecret', { secret: '1234' });
  guest.send('setSecret', { secret: '5678' });
  guest.disconnect();
  const returned = h.connect('returned');
  returned.send('rejoinRoom', { roomId, playerId: guest.id, playerName: 'Player 1' });
  const state = host.last('playerRejoined').room;
  assert.equal(state.players.find(p => p.id === returned.id).secret, null);
  assert.equal(state.players.find(p => p.id === host.id).secret, '1234');
  assert.equal(returned.last('roomRejoined').room.players.find(p => p.id === returned.id).secret, '5678');
});

test('removing an earlier player preserves the current truth-or-dare turn', () => {
  const h = harness('truthordare');
  const { players: [host, middle, current] } = h.room(3);
  host.send('startGame');
  host.send('skipTurn');
  host.send('skipTurn');
  current.send('choosePrompt', { type: 'truth' });
  middle.disconnect();
  h.tick(30000);
  const state = host.last('playerLeft').room;
  assert.equal(state.currentPlayer.id, current.id);
  assert.equal(state.currentPrompt.playerId, current.id);
});

test('active browser session rejoins after transport reconnect', () => {
  const handlers = new Map();
  const sent = [];
  const storage = new Map();
  const window = {};
  const socket = {
    id: 'old', connected: false,
    on(event, fn) { handlers.set(event, fn); },
    emit(event, data) { sent.push({ event, data }); }
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../public/shared/session.js'), 'utf8'), {
    window, setTimeout, localStorage: {
      getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    }
  });
  const session = window.PartySession.setup('dice', socket, { hasActiveSession: () => true });
  handlers.get('roomCreated')({ roomId: 'ABC123', player: { id: 'old', name: 'Player' } });
  handlers.get('connect')();
  assert.equal(sent.length, 0);
  socket.id = 'new';
  handlers.get('connect')();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].event, 'rejoinRoom');
  assert.equal(sent[0].data.playerId, 'old');
  handlers.get('roomRejoined')({ roomId: 'ABC123', player: { id: 'new', name: 'Player' } });
  handlers.get('connect')();
  assert.equal(sent.length, 1);
  session.clear();
  assert.equal(session.load(), null);
});
