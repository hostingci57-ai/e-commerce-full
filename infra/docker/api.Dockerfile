# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# @ecf/api — NestJS 11 (Fastify) + Prisma 6
# Multi-stage build; runtime runs as non-root, exposes 3001, has healthcheck.
# -----------------------------------------------------------------------------

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

# 1. Dependencies layer — only package manifests for a cache-friendly install
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/validation/package.json ./packages/validation/
COPY packages/types/package.json ./packages/types/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

# 2. Build stage
FROM base AS build
COPY --from=deps /app ./
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile
RUN pnpm --filter @ecf/db generate
RUN pnpm --filter @ecf/api build

# 3. Production prune (workspace-aware, keeps only @ecf/api runtime deps)
FROM base AS prune
COPY --from=build /app ./
RUN pnpm --filter @ecf/api deploy --prod --legacy /out || \
    (echo "deploy failed, falling back to full node_modules" && mkdir -p /out && cp -r /app/node_modules /out/node_modules && cp -r /app/apps/api /out/)

# 4. Runtime
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    NODE_OPTIONS="--enable-source-maps"

RUN addgroup -S ecf && adduser -S ecf -G ecf

# Copy runtime artifacts from build stage (simpler than prune for workspace builds)
COPY --from=build --chown=ecf:ecf /app/node_modules ./node_modules
COPY --from=build --chown=ecf:ecf /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=ecf:ecf /app/apps/api/package.json ./apps/api/
COPY --from=build --chown=ecf:ecf /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=ecf:ecf /app/packages/db/src ./packages/db/src
COPY --from=build --chown=ecf:ecf /app/packages/db/package.json ./packages/db/
COPY --from=build --chown=ecf:ecf /app/packages/db/prisma ./packages/db/prisma
COPY --from=build --chown=ecf:ecf /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=build --chown=ecf:ecf /app/packages/validation/src ./packages/validation/src
COPY --from=build --chown=ecf:ecf /app/packages/validation/package.json ./packages/validation/
COPY --from=build --chown=ecf:ecf /app/packages/types/src ./packages/types/src
COPY --from=build --chown=ecf:ecf /app/packages/types/package.json ./packages/types/
COPY --from=build --chown=ecf:ecf /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./

USER ecf
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 3001) + '/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
