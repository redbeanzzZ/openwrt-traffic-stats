# ---- 构建阶段 ----
FROM node:22-alpine AS builder
WORKDIR /app

# 先复制 package*.json 利用 docker 层缓存
COPY package.json package-lock.json* ./
RUN npm ci

# 复制源码,编译 TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 修剪掉 devDependencies,留下生产依赖
RUN npm prune --omit=dev

# ---- 运行阶段 ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# 仅复制运行所需:dist + 生产 node_modules + package.json(为了 main 字段)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 健康检查(可选,Express 不强制有 /api/health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3100}/api/health" >/dev/null 2>&1 || exit 1

EXPOSE 3100
CMD ["node", "dist/index.js"]
