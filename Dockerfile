FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN mkdir -p public \
    && npm run build \
    && ./node_modules/.bin/esbuild src/db/migrate-production.ts \
      --bundle \
      --platform=node \
      --format=cjs \
      --outfile=migrate-production.cjs \
    && ./node_modules/.bin/esbuild src/db/create-admin.ts \
      --bundle \
      --platform=node \
      --format=cjs \
      --external:argon2 \
      --outfile=create-admin.cjs

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/migrate-production.cjs ./
COPY --from=builder --chown=nextjs:nodejs /app/create-admin.cjs ./
COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/piccolo-entrypoint
RUN chmod 0755 /usr/local/bin/piccolo-entrypoint

USER nextjs

EXPOSE 3000

ENTRYPOINT ["piccolo-entrypoint"]
CMD ["node", "server.js"]
