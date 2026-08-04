FROM node:22.20.0-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

COPY . .
RUN npm run build -w @cursor-agent-web/web
RUN npm run build -w @cursor-agent-web/shared
RUN npm run build -w @cursor-agent-web/server

FROM node:22.20.0-bookworm-slim AS runner
WORKDIR /app

# 不要在镜像里写死 PORT；Railway 会注入 PORT，健康检查也走这个端口
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

COPY apps/server/dist ./apps/server/dist
COPY packages/shared/dist ./packages/shared/dist
COPY packages/shared/src ./packages/shared/src
COPY --from=build /app/apps/web/dist ./apps/web/dist

RUN mkdir -p /data/workspace/chat

# Railway 不支持 Dockerfile 的 VOLUME 指令；持久化请在面板挂载 Volume 到 /data
CMD ["npx", "tsx", "apps/server/src/index.ts"]
