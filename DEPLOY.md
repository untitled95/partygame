# 小姐牌 - 在线抽牌喝酒游戏

## 部署指南

### 方式一：直接部署

1. **上传文件到服务器**
```bash
# 使用 scp 上传（替换为你的服务器信息）
scp -r ./* user@your-server:/var/www/partygame/
```

2. **在服务器上安装依赖**
```bash
cd /var/www/partygame
npm install --production
```

3. **启动服务**
```bash
# 方式1: 直接运行（测试用）
node server.js

# 方式2: 使用 PM2 守护进程（推荐生产环境）
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 设置开机自启
```

### 方式二：使用 Nginx 反向代理（推荐）

1. **安装 Nginx**
```bash
sudo apt update
sudo apt install nginx
```

2. **配置 Nginx** (`/etc/nginx/sites-available/partygame`)
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. **启用配置**
```bash
sudo ln -s /etc/nginx/sites-available/partygame /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 方式三：使用 Docker

1. **构建镜像**
```bash
docker build -t party-card-game .
```

2. **运行容器**
```bash
docker run -d -p 3000:3000 --name partygame party-card-game
```

---

## 常用命令

```bash
# PM2 相关
pm2 list              # 查看运行状态
pm2 logs partygame    # 查看日志
pm2 restart partygame # 重启服务
pm2 stop partygame    # 停止服务

# 查看端口占用
netstat -tlnp | grep 3000
```

## 防火墙设置

```bash
# 如果使用 ufw
sudo ufw allow 3000

# 如果使用 firewalld
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

## 环境变量

- `PORT`: 服务端口，默认 3000
- `NODE_ENV`: 环境，生产环境设为 `production`
