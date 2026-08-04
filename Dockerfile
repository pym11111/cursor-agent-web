FROM node:22.20.0-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

COPY . .
RUN npm run build -w @cursor-agent-web/web

FROM node:22.20.0-bookworm-slim AS runner
WORKDIR /app

# 不要写死 PORT；Railway 会注入 PORT，健康检查也走该端口
ENV NODE_ENV=production \
    DATA_DIR=/data \
    AGENT_WORKSPACE=/data/workspace \
    CHAT_WORKSPACE=/data/workspace/chat \
    DATABASE_PATH=/data/app.db

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev

# 启动入口是 tsx + TypeScript 源码，必须复制 src（不要只复制 dist）
COPY apps/server/src ./apps/server/src
COPY apps/server/tsconfig.json ./apps/server/tsconfig.json
COPY packages/shared ./packages/shared
COPY --from=build /app/apps/web/dist ./apps/web/dist

RUN mkdir -p /data/workspace/chat

CMD ["npx", "tsx", "apps/server/src/index.ts"]
