FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate
RUN apk add --no-cache libc6-compat

FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo@2.8.20 prune @frontdesk/realtime-gateway --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY --from=pruner /app/out/full/ ./
RUN pnpm --filter @frontdesk/db run prisma:generate
RUN pnpm turbo build --filter=@frontdesk/realtime-gateway...
RUN pnpm prune --prod --no-optional
RUN pnpm --filter @frontdesk/db run prisma:generate

FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
COPY --from=builder --chown=node:node /app ./
USER node
EXPOSE 3002
CMD ["dumb-init", "node", "apps/realtime-gateway/dist/index.js"]
