FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY design ./design
COPY bot ./bot

RUN npm ci
RUN npm run build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/design ./design
COPY --from=builder /app/bot ./bot

RUN mkdir -p /app/data/uploads

EXPOSE 3000

CMD ["sh", "-c", "set -e; if [ -f /app/standalone/package.json ]; then cd /app/standalone; else cd /app; fi; test -f apps/api/dist/main.js || npm run build; if [ -f node_modules/tsx/dist/cli.mjs ]; then exec node node_modules/tsx/dist/cli.mjs apps/api/dist/main.js; fi; if [ -f ../node_modules/tsx/dist/cli.mjs ]; then exec node ../node_modules/tsx/dist/cli.mjs apps/api/dist/main.js; fi; echo 'tsx runtime not found' >&2; exit 1"]
