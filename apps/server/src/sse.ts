import type { Response } from "express";
import type { SseEvent } from "@cursor-agent-web/shared";

export function initSse(res: Response) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function sendSse(res: Response, event: SseEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
