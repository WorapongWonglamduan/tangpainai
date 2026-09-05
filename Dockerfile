FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
# npm ci demands the lockfile list every optional platform-specific package
# (native bindings for sharp/lightningcss/@next-swc, etc.) for the platform
# it's running on — this lockfile was last generated on Windows, so it's
# missing the Linux-alpine ones `npm ci` wants here. `npm install` re-resolves
# those for the current platform instead of hard-failing on the mismatch.
RUN npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Next.js inlines NEXT_PUBLIC_* vars into the client bundle at build time, not
# at container runtime — must arrive as a build ARG (wired from docker-
# compose's build.args / the GitHub Actions build-push-action step), not just
# the runner stage's `environment:` block in docker-compose.yml.
ARG NEXT_PUBLIC_LIFF_ID
ENV NEXT_PUBLIC_LIFF_ID=${NEXT_PUBLIC_LIFF_ID}

RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Every "current month" boundary this app computes (dashboard month filter,
# expense occurredAt grouping) is done with explicit Asia/Bangkok UTC math in
# code, not the container clock — but tzdata + TZ is still set here so log
# timestamps and anything else that reads the system clock read Bangkok time
# too, matching the other projects' containers.
RUN apk add --no-cache tzdata
ENV TZ=Asia/Bangkok

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
