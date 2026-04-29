const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

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

// 加载游戏模块
const drinkingGame = require('./games/drinkinggame');
const drawGuess = require('./games/drawguess');
const undercover = require('./games/undercover');
const werewolf = require('./games/werewolf');
const dice = require('./games/dice');
const truthOrDare = require('./games/truthordare');
const guessNumber = require('./games/guessnumber');

// 初始化各游戏的 Socket 事件
drinkingGame.initSocket(io);     // 默认命名空间，抽牌喝酒
drawGuess.initSocket(io);         // /drawguess 命名空间，你画我猜
undercover.initSocket(io);        // /undercover 命名空间，谁是卧底
werewolf.initSocket(io);          // /werewolf 命名空间，狼人杀
dice.initSocket(io);              // /dice 命名空间，骰子游戏
truthOrDare.initSocket(io);       // /truthordare 命名空间，真心话大冒险
guessNumber.initSocket(io);       // /guessnumber 命名空间，猜数字

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 派对游戏服务器运行在 http://localhost:${PORT}`);
  console.log(`   - 抽牌喝酒: /drinkinggame/`);
  console.log(`   - 你画我猜: /drawguess/`);
  console.log(`   - 谁是卧底: /undercover/`);
  console.log(`   - 狼人杀: /werewolf/`);
  console.log(`   - 骰子游戏: /dice/`);
  console.log(`   - 真心话大冒险: /truthordare/`);
  console.log(`   - 猜数字: /guessnumber/`);
});
