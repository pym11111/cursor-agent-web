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

ENV NODE_ENV=production \
    PORT=3001 \
    DATA_DIR=/data \
    AGENT_WORKSPACE=/data/workspace \
    CHAT_WORKSPACE=/data/workspace/chat \
    DATABASE_PATH=/data/app.db

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev

COPY apps/server ./apps/server
COPY packages/shared ./packages/shared
COPY --from=build /app/apps/web/dist ./apps/web/dist

RUN mkdir -p /data/workspace/chat

EXPOSE 3001

# Railway 不支持 Dockerfile 的 VOLUME 指令；持久化请在面板挂载 Volume 到 /data
# 健康检查用 railway.toml 的 healthcheckPath

CMD ["npx", "tsx", "apps/server/src/index.ts"]
