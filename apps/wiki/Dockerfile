# Merlin Wiki / Docs — standalone image for Coolify
# Build context: monorepo root (docker build -f apps/wiki/Dockerfile .)
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
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/email/package.json ./packages/email/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# fumadocs-mdx postinstall needs wiki source at install time
COPY apps/wiki/content ./apps/wiki/content
COPY apps/wiki/lib ./apps/wiki/lib
COPY apps/wiki/source.config.ts ./apps/wiki/source.config.ts
COPY apps/wiki/mdx-components.tsx ./apps/wiki/mdx-components.tsx
COPY apps/wiki/next.config.mjs ./apps/wiki/next.config.mjs
COPY apps/wiki/tsconfig.json ./apps/wiki/tsconfig.json

RUN --mount=type=cache,target=/root/.yarn/berry/cache,sharing=locked \
    --mount=type=cache,target=/root/.cache/yarn,sharing=locked \
    echo "Installing build dependencies for wiki on $BUILDPLATFORM for $TARGETPLATFORM" && \
    yarn workspaces focus wiki

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-slim AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URI=https://api.example.com
ARG NEXT_PUBLIC_DASHBOARD_URI=https://app.example.com
ARG NEXT_PUBLIC_WIKI_URI=https://docs.example.com

RUN corepack enable && corepack prepare yarn@4.9.1 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn
COPY --from=deps /app/.yarnrc.yml ./
COPY --from=deps /app/package.json ./
COPY --from=deps /app/yarn.lock ./

COPY turbo.json ./
COPY apps/wiki ./apps/wiki

RUN mkdir -p /tmp/build-deps && cd /tmp/build-deps && npm init -y >/dev/null 2>&1 && npm install dotenv@17.0.1 && \
    ln -s /tmp/build-deps/node_modules/dotenv /app/node_modules/dotenv

RUN cd apps/wiki && \
    node scripts/generate-openapi.js && \
    npx tsx scripts/generate-docs.mts && \
    npx fumadocs-mdx && \
    cd ../..

RUN --mount=type=cache,target=/root/.npm \
    npm install -g turbo@2.6.0 typescript@5.7.2 --prefer-offline --no-audit
RUN --mount=type=cache,target=/app/.turbo,sharing=locked \
    API_URI=${NEXT_PUBLIC_API_URI} \
    DASHBOARD_URI=${NEXT_PUBLIC_DASHBOARD_URI} \
    WIKI_URI=${NEXT_PUBLIC_WIKI_URI} \
    NEXT_PUBLIC_API_URI=${NEXT_PUBLIC_API_URI} \
    NEXT_PUBLIC_DASHBOARD_URI=${NEXT_PUBLIC_DASHBOARD_URI} \
    NEXT_PUBLIC_WIKI_URI=${NEXT_PUBLIC_WIKI_URI} \
    turbo build --filter=wiki
RUN NEXT_PUBLIC_WIKI_URI=${NEXT_PUBLIC_WIKI_URI} yarn workspace wiki sitemap

# ============================================
# Stage 3: Production runtime
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 merlin

COPY --from=builder --chown=merlin:nodejs /app/apps/wiki/.next/standalone ./
COPY --from=builder --chown=merlin:nodejs /app/apps/wiki/public ./apps/wiki/public
COPY --from=builder --chown=merlin:nodejs /app/apps/wiki/.next/static ./apps/wiki/.next/static
COPY --from=builder --chown=merlin:nodejs /app/apps/wiki/openapi.local.json ./apps/wiki/openapi.local.json

USER merlin

EXPOSE 1000

ENV NODE_ENV=production
ENV PORT=1000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/wiki/server.js"]
