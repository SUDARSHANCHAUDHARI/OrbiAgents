import { Request, Response, NextFunction } from "express";
import { db } from "./db";

interface RateLimitOptions {
  key: string;
  windowMs: number;
  max: number;
  message: string;
}

export function getBucketKey(req: Request, key: string): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const userId = req.userId ?? "anon";
  return `${key}:${userId}:${ip}`;
}

export function createRateLimit(options: RateLimitOptions) {
  return async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
    const bucketKey = getBucketKey(req, options.key);
    const now = Date.now();
    const newWindow = () => new Date(now + options.windowMs);
    // Atomic increment: the count returned is this request's position in the window, so parallel requests cannot all pass.
    let bucket = await db.rateLimitBucket.upsert({
      where: { id: bucketKey },
      create: { id: bucketKey, scope: options.key, count: 1, resetAt: newWindow() },
      update: { count: { increment: 1 } },
    });

    if (bucket.resetAt.getTime() <= now) {
      // Expired window: only the request that swaps the old resetAt starts the new window; the rest count against it.
      const restarted = await db.rateLimitBucket.updateMany({
        where: { id: bucketKey, resetAt: bucket.resetAt },
        data: { scope: options.key, count: 1, resetAt: newWindow() },
      });
      if (restarted.count === 1) { next(); return; }
      bucket = await db.rateLimitBucket.update({
        where: { id: bucketKey },
        data: { count: { increment: 1 } },
      });
    }

    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt.getTime() - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      res.status(429).json({ error: options.message });
      return;
    }

    next();
  };
}
