# 🎮 派对游戏合集

一个基于 Node.js、Express 和 Socket.IO 的派对小游戏合集。玩家可以创建房间、分享房间号实时联机，也可以直接打开单人小游戏休闲游玩。

## ✨ 功能特点

- 📱 支持手机端访问，移动端适配
- 👥 多人实时在线房间
- 🔗 房间号邀请好友加入
- ⚡ Socket.IO 实时同步游戏状态
- 🎮 14 个可玩的派对小游戏
- 🧩 单人小游戏无需创建房间，打开即可玩
- 📴 支持单人游戏离线缓存，首次访问后断网也能继续打开
- 🐳 支持 Docker / PM2 部署

## 🕹️ 已支持游戏

| 路径 | 游戏 | 简介 |
|---|---|---|
| `/drinkinggame/` | 🍻 抽牌喝酒 | 经典小姐牌，轮流抽牌、手牌效果、K规则、新一轮洗牌 |
| `/drawguess/` | 🎨 你画我猜 | 一人画画、其他人猜词，支持画板同步、计时、积分排行 |
| `/undercover/` | 🕵️ 谁是卧底 | 自动分配相近词语，玩家描述后投票找出卧底 |
| `/werewolf/` | 🐺 狼人杀 | 简化版狼人杀，包含狼人、预言家、女巫、村民和昼夜投票流程 |
| `/dice/` | 🎲 骰子游戏 | 多人摇骰比大小，按轮计分并结算赢家 |
| `/truthordare/` | ❓ 真心话大冒险 | 轮流选择真心话、大冒险或随机题目 |
| `/guessnumber/` | 🔢 猜数字 | 双人对战，设置4位不重复数字，轮流猜几A几B |
| `/solo2048/` | 🧩 2048 | 单人滑动合并数字，挑战高分 |
| `/memory/` | 🧠 记忆翻牌 | 单人闯关翻牌配对，牌数逐关增加并统计步数和用时 |
| `/reaction/` | ⚡ 反应测速 | 单人反应速度测试，记录最佳成绩 |
| `/snake/` | 🐍 贪吃蛇 | 单人方向控制，吃果子得分并逐步加速 |
| `/minesweeper/` | 💣 扫雷 | 单人九宫格扫雷，支持首次安全点击和插旗模式 |
| `/tictactoe/` | ⭕ 井字棋 | 单人对战电脑，自动记录胜负和平局 |
| `/huarongdao/` | 🐱 猫咪华容道 | 单人猫 meme 版横刀立马布局，移动猫猫帮助老板猫突围 |

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

然后访问 `http://localhost:3000` 进入游戏大厅。

### 生产环境部署

```bash
# 使用 PM2
npm install -g pm2
pm2 start ecosystem.config.js
```

## 🛠️ 技术栈

- **后端**: Node.js + Express + Socket.IO
- **前端**: HTML5 + CSS3 + JavaScript
- **实时通信**: WebSocket
- **状态存储**: 多人游戏使用服务器内存 Map（重启后房间状态会清空），单人游戏使用浏览器本地状态/LocalStorage
- **离线缓存**: Service Worker 预缓存大厅和单人游戏资源；适用于 `localhost` 和 HTTPS 环境

## 📁 项目结构

```
partygame/
├── server.js                 # 服务器入口
├── games/                    # 各游戏 Socket.IO 后端逻辑
│   ├── drinkinggame.js
│   ├── drawguess.js
│   ├── undercover.js
│   ├── werewolf.js
│   ├── dice.js
│   ├── truthordare.js
│   └── guessnumber.js
├── public/                   # 前端静态文件
│   ├── index.html            # 游戏大厅
│   ├── shared/               # 新游戏共享样式
│   ├── drinkinggame/
│   ├── drawguess/
│   ├── undercover/
│   ├── werewolf/
│   ├── dice/
│   ├── truthordare/
│   ├── guessnumber/
│   ├── solo2048/
│   ├── memory/
│   ├── reaction/
│   ├── snake/
│   ├── minesweeper/
│   ├── tictactoe/
│   └── huarongdao/
├── data/
│   └── drawguess-words.json  # 你画我猜词库
├── ecosystem.config.js       # PM2 配置
├── Dockerfile                # Docker 配置
└── DEPLOY.md                 # 部署说明
```

## ⚠️ 注意事项

- 当前房间和游戏状态保存在单个 Node.js 进程内存中，不适合多实例横向扩容。
- 页面没有账号系统，房间号即加入凭证。
- 单人游戏是纯前端实现，不需要 WebSocket 连接。
- 狼人杀为适合线上快速游玩的简化规则，不覆盖完整桌游全部身份和流程。

## 📝 License

MIT
