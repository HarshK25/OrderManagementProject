# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build — Node 20
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (better layer caching)
COPY package.json package-lock.json* ./

RUN npm install --no-audit

COPY . .

# VITE_API_BASE_URL is not needed since nginx proxies /api internally
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Serve — Nginx
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove default config
RUN rm -f /etc/nginx/conf.d/default.conf.bak

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
