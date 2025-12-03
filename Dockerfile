# Stage para dependências de produção apenas (leve e isolado - Factor II)
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Builder: adiciona devDeps para build e testes (separado do run - Factor V)
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --include=dev  # Instala prod + devDeps
COPY . .
RUN npx prisma generate
RUN npm run build:api
RUN npm run build:test

# Runner: usa prod-deps (sem devDeps), copia artifacts do builder (disposability rápida - Factor IX)
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache curl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia node_modules de produção apenas (isolamento)
COPY --from=prod-deps /app/node_modules ./node_modules
# Copia artifacts built
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts 

USER nextjs
EXPOSE 3000
CMD ["npm", "start"]