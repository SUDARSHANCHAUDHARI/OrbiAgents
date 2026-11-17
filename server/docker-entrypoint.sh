#!/bin/sh
set -eu

# Keep the SQLite file on the prisma/data volume so it survives container recreation.
mkdir -p /app/prisma/data
[ -e /app/prisma/dev.db ] || [ -L /app/prisma/dev.db ] || ln -s data/dev.db /app/prisma/dev.db

pnpm exec prisma migrate deploy
exec pnpm exec ts-node index.ts
