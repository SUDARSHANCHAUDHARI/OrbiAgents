import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

function isoNow(): string {
  return new Date().toISOString();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID().slice(0, 8);
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const userId = req.userId ?? "anon";
    console.log(
      `[${isoNow()}] ${requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms user=${userId}`
    );
  });

  next();
}

export function logServerEvent(message: string): void {
  console.log(`[${isoNow()}] ${message}`);
}
