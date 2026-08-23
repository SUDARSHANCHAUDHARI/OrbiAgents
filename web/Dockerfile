FROM node:20-alpine AS base
WORKDIR /app/web
RUN corepack enable

FROM base AS deps
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY web .
COPY shared ../shared
RUN pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
