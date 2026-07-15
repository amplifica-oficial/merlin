# Merlin API / Worker — standalone image for Coolify
# Build context: monorepo root (docker build -f apps/api/Dockerfile .)
# SERVICE=server (default) runs HTTP API + migrations; SERVICE=worker runs BullMQ worker

# ============================================
# Stage 1: Dependencies (build)
# ============================================
FROM --platform=$BUILDPLATFORM node:20-slim AS deps
ARG TARGETPLATFORM
ARG BUILDPLATFORM
WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.9.1 --activate

COPY .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/wiki/package.json ./apps/wiki/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/
COPY packages/email/package.json ./packages/email/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN --mount=type=cache,target=/root/.yarn/berry/cache,sharing=locked \
    --mount=type=cache,target=/root/.cache/yarn,sharing=locked \
    echo "Installing build dependencies for API on $BUILDPLATFORM for $TARGETPLATFORM" && \
    yarn workspaces focus api

# ============================================
# Stage 1b: Production dependencies
# ============================================
FROM --platform=$BUILDPLATFORM node:20-slim AS prod-deps
ARG TARGETPLATFORM
ARG BUILDPLATFORM
WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.9.1 --activate

COPY .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/
COPY packages/email/package.json ./packages/email/

RUN --mount=type=cache,target=/root/.yarn/berry/cache,sharing=locked \
    --mount=type=cache,target=/root/.cache/yarn,sharing=locked \
    echo "Installing production dependencies for API on $BUILDPLATFORM for $TARGETPLATFORM" && \
    yarn workspaces focus api --production

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare yarn@4.9.1 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn
COPY --from=deps /app/.yarnrc.yml ./
COPY --from=deps /app/package.json ./
COPY --from=deps /app/yarn.lock ./

COPY turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN yarn workspace @merlin/db db:generate
RUN --mount=type=cache,target=/root/.npm \
    npm install -g turbo@2.6.0 typescript@5.7.2 --prefer-offline --no-audit
RUN --mount=type=cache,target=/app/.turbo,sharing=locked \
    turbo build --filter=api

# ============================================
# Stage 3: Production runtime
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl curl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 merlin

COPY --from=builder --chown=merlin:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=prod-deps --chown=merlin:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=merlin:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=merlin:nodejs /app/node_modules/@prisma ./node_modules/@prisma

COPY --from=builder --chown=merlin:nodejs /app/packages/db/dist ./packages/db/dist
COPY --from=builder --chown=merlin:nodejs /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder --chown=merlin:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=merlin:nodejs /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=merlin:nodejs /app/packages/email/dist ./packages/email/dist
COPY --from=builder --chown=merlin:nodejs /app/packages/email/package.json ./packages/email/package.json
COPY --from=builder --chown=merlin:nodejs /app/packages/types/dist ./packages/types/dist
COPY --from=builder --chown=merlin:nodejs /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder --chown=merlin:nodejs /app/packages/db/prisma ./packages/db/prisma

COPY --from=builder --chown=merlin:nodejs /app/package.json ./
COPY --from=builder --chown=merlin:nodejs /app/apps/api/package.json ./apps/api/

COPY --chown=merlin:nodejs apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER merlin

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV SERVICE=server

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD sh -c 'if [ "$SERVICE" = "worker" ]; then exit 0; fi; curl -f http://localhost:8080/health || exit 1'

ENTRYPOINT ["docker-entrypoint.sh"]
