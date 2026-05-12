# ---- 构建阶段 ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json tsconfig.node.json vite.config.ts index.html env.d.ts ./
COPY src ./src
RUN npm run build

# ---- 运行阶段:nginx 静态服务 + /api 反代到 backend ----
FROM nginx:1.27-alpine AS runtime

# 替换默认配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
