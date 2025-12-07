# Dockerfile — VERSÃO FINAL (100–140 MB) ← cole e substitua o atual

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts   # ← só prod aqui

FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci --include=dev                          # instala tudo (dev + prod) só no builder
COPY . .
RUN npx prisma generate
RUN npm run build:api
RUN npm run build:test

# ← IMAGEM FINAL ENXUTA (a que importa)
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# ← AQUI ESTÁ A MÁGICA: copia node_modules de PRODUÇÃO, não do builder!
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser
USER appuser

EXPOSE 3000
CMD ["node", "dist/server.js"]