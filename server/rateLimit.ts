import { Request, Response, NextFunction } from "express";
import { db } from "./db";

interface RateLimitOptions {
  key: string;
  windowMs: number;
  max: number;
  message: string;
}

function getBucketKey(req: Request, key: string): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  const userId = req.userId ?? "anon";
  return `${key}:${userId}:${ip}`;
}

export function createRateLimit(options: RateLimitOptions) {
  return async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
    const bucketKey = getBucketKey(req, options.key);
    const now = Date.now();
    const current = await db.rateLimitBucket.findUnique({
      where: { id: bucketKey },
    });

    if (!current || current.resetAt.getTime() <= now) {
      await db.rateLimitBucket.upsert({
        where: { id: bucketKey },
        create: {
          id: bucketKey,
          scope: options.key,
          count: 1,
          resetAt: new Date(now + options.windowMs),
        },
        update: {
          scope: options.key,
          count: 1,
          resetAt: new Date(now + options.windowMs),
        },
      });
      next();
      return;
    }

    if (current.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt.getTime() - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      res.status(429).json({ error: options.message });
      return;
    }

    await db.rateLimitBucket.update({
      where: { id: bucketKey },
      data: { count: { increment: 1 } },
    });
    next();
  };
}
