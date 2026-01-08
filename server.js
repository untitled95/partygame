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

// 初始化各游戏的 Socket 事件
drinkingGame.initSocket(io);     // 默认命名空间，抽牌喝酒
drawGuess.initSocket(io);         // /drawguess 命名空间，你画我猜

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 派对游戏服务器运行在 http://localhost:${PORT}`);
  console.log(`   - 抽牌喝酒: /drinkinggame/`);
  console.log(`   - 你画我猜: /drawguess/`);
});
