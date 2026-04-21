# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# @ecf/landlord-admin — Next.js 15 (App Router, standalone output)
# -----------------------------------------------------------------------------

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/landlord-admin/package.json ./apps/landlord-admin/
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/db/package.json ./packages/db/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

FROM base AS build
COPY --from=deps /app ./
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @ecf/db generate
RUN pnpm --filter @ecf/landlord-admin build

FROM node:20-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S ecf && adduser -S ecf -G ecf

COPY --from=build --chown=ecf:ecf /app/apps/landlord-admin/.next/standalone ./
COPY --from=build --chown=ecf:ecf /app/apps/landlord-admin/.next/static ./apps/landlord-admin/.next/static
# landlord-admin has no public/ dir in MVP; standalone output handles absence.

USER ecf
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 3000) + '/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/landlord-admin/server.js"]
