import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { appConfig } from "./config.js";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function issueSessionToken(password: string): string {
  const pepper = appConfig.apiKey.slice(0, 8) || "no-api-key";
  return hash(`${password}:${pepper}`);
}

export function isAuthed(req: Request): boolean {
  const token = req.cookies?.[appConfig.sessionCookie];
  if (!token || typeof token !== "string") return false;
  const expected = issueSessionToken(appConfig.appPassword);
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  next();
}
