# Stage 1: Dependências
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Desabilita telemetria do Next.js durante o build
ENV NEXT_TELEMETRY_DISABLED 1

# Compila o Next.js e o Server Customizado
RUN npm run build

# Stage 3: Runner (Produção)
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Cria usuário não-root (Segurança)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia apenas o necessário do build
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Define permissões
USER nextjs

# Expõe a porta (Fator VII)
EXPOSE 3000

# Comando de inicialização (Fator V)
CMD ["npm", "start"]