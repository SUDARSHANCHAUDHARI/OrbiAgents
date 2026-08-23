FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl \
    && corepack enable \
    && corepack prepare pnpm@10.28.2 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm exec prisma generate
RUN pnpm exec tsc --noEmit

FROM base AS runtime
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/*.ts ./
COPY --from=build /app/agents ./agents
COPY --from=build /app/types ./types
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh

EXPOSE 4000

CMD ["sh", "/app/docker-entrypoint.sh"]
