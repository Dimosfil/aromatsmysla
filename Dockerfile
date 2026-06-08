FROM node:20-alpine AS builder

WORKDIR /app

COPY standalone/package.json standalone/package-lock.json standalone/tsconfig.base.json ./
COPY standalone/apps ./apps
COPY standalone/packages ./packages
COPY standalone/design ./design
COPY standalone/bot ./bot

RUN npm ci
RUN npm run build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/bot ./bot

RUN mkdir -p /app/data/uploads

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
