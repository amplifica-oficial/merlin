# Merlin Web Dashboard — standalone image for Coolify
# Build context: monorepo root (docker build -f apps/web/Dockerfile .)
# Set NEXT_PUBLIC_* build args to your production URLs before building.

# ============================================
# Stage 1: Dependencies
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
COPY packages/email/package.json ./packages/email/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN --mount=type=cache,target=/root/.yarn/berry/cache,sharing=locked \
    --mount=type=cache,target=/root/.cache/yarn,sharing=locked \
    echo "Installing build dependencies for web on $BUILDPLATFORM for $TARGETPLATFORM" && \
    yarn workspaces focus web

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-slim AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URI=https://api.example.com
ARG NEXT_PUBLIC_DASHBOARD_URI=https://app.example.com
ARG NEXT_PUBLIC_WIKI_URI=https://docs.example.com

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare yarn@4.9.1 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn
COPY --from=deps /app/.yarnrc.yml ./
COPY --from=deps /app/package.json ./
COPY --from=deps /app/yarn.lock ./

COPY turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN yarn workspace @merlin/db db:generate
RUN --mount=type=cache,target=/root/.npm \
    npm install -g turbo@2.6.0 typescript@5.7.2 --prefer-offline --no-audit
RUN --mount=type=cache,target=/app/.turbo,sharing=locked \
    API_URI=${NEXT_PUBLIC_API_URI} \
    DASHBOARD_URI=${NEXT_PUBLIC_DASHBOARD_URI} \
    WIKI_URI=${NEXT_PUBLIC_WIKI_URI} \
    NEXT_PUBLIC_API_URI=${NEXT_PUBLIC_API_URI} \
    NEXT_PUBLIC_DASHBOARD_URI=${NEXT_PUBLIC_DASHBOARD_URI} \
    NEXT_PUBLIC_WIKI_URI=${NEXT_PUBLIC_WIKI_URI} \
    turbo build --filter=web
RUN NEXT_PUBLIC_DASHBOARD_URI=${NEXT_PUBLIC_DASHBOARD_URI} yarn workspace web sitemap

# ============================================
# Stage 3: Production runtime
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 merlin

COPY --from=builder --chown=merlin:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=merlin:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=merlin:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER merlin

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
