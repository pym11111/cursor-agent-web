# Cursor Agent Web

个人 Agent 对话站：聊天模式 + 编码 Agent，日算力限额，本机 → Railway 公网。

> 开发请用 **Node 22+**（`nvm use 22.20.0`）。`@cursor/sdk` 不支持 Node 20。

## 进度

| Phase | 状态 |
|-------|------|
| 0 环境 | 完成 |
| 1 SDK 冒烟 | 完成 |
| 2 HTTP + SSE + SQLite | 完成 |
| 3 前端对话页 | 完成 |
| 4 双模式差异 | 完成 |
| 5 日算力限额 | 完成 |
| 6 Docker / Railway | 配置已就绪（需本机 Docker 或推到 Railway 远程构建） |

## 本地开发

```powershell
cd C:\Users\THS\cursor-agent-web
nvm use 22.20.0
npm run dev:server
npm run dev:web
```

打开 http://localhost:5173 ，用 `.env` 的 `APP_PASSWORD` 登录。

| 命令 | 作用 |
|------|------|
| `npm run env:check` | 检查 .env |
| `npm run sdk:smoke` | SDK 冒烟 |
| `npm run test` | 服务端单测 |
| `npm run build` | 构建前端到 `apps/web/dist` |
| `npm start` | 单进程托管 API + 前端静态资源 |

生产形态本地预览：

```powershell
npm run build
$env:NODE_ENV="production"
npm start
# 打开 http://localhost:3001
```

## Phase 6 部署

### A. Docker（本机需 Docker Desktop）

> 若拉取 `node` 镜像报 Docker Hub EOF，可先：
> `docker pull docker.m.daocloud.io/library/node:22.20.0-bookworm-slim`
> `docker tag docker.m.daocloud.io/library/node:22.20.0-bookworm-slim node:22.20.0-bookworm-slim`

```powershell
docker compose up --build -d
# http://localhost:3001
docker compose logs -f
docker compose down
```

数据落在 volume `agent-data` → 容器内 `/data`。

### B. Railway（推荐公网）

1. 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（可选；Railway 也可远程按 `Dockerfile` 构建）
2. 把本仓库推到 GitHub（需先 `git init` + 创建远程仓库）
3. 打开 [Railway](https://railway.app) → New Project → Deploy from GitHub Repo
4. 服务会读取根目录 `Dockerfile` / `railway.toml`
5. **Variables** 至少配置：

```env
CURSOR_API_KEY=cursor_你的key
APP_PASSWORD=强密码
DAILY_RUN_LIMIT=20
DAILY_MESSAGE_LIMIT=100
MODEL_ID=composer-2.5
NODE_ENV=production
DATA_DIR=/data
DATABASE_PATH=/data/app.db
AGENT_WORKSPACE=/data/workspace
CHAT_WORKSPACE=/data/workspace/chat
CORS_ORIGIN=https://你的服务.up.railway.app
```

6. **Volumes**：挂载到 `/data`（持久化 SQLite + workspace）
7. 生成公网域名（Settings → Networking → Generate Domain）
8. 用密码登录验证；浏览器网络面板中不应出现 `CURSOR_API_KEY`

### C. 临时公网（不部署）

本机先 `npm run build && npm start`，再：

```powershell
cloudflared tunnel --url http://localhost:3001
```

## 安全提醒

- API Key 只放服务端环境变量
- 公网必须改掉默认 `APP_PASSWORD`
- 编码 Agent 的 workspace 限制在 `/data/workspace`，不要挂整盘
