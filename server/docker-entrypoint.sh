#!/bin/sh
set -eu

pnpm exec prisma migrate deploy
exec pnpm exec ts-node index.ts
