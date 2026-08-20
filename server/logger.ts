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
      `[${isoNow()}] ${requestId} ${req.method} ${safeRequestPath(req.originalUrl)} ${res.statusCode} ${durationMs}ms user=${userId}`
    );
  });

  next();
}

export function safeRequestPath(originalUrl: string): string {
  const queryIndex = originalUrl.indexOf("?");
  return queryIndex === -1 ? originalUrl : originalUrl.slice(0, queryIndex);
}

export function logServerEvent(message: string): void {
  console.log(`[${isoNow()}] ${message}`);
}
