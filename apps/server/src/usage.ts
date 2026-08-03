import { usageDateKey } from "./usage-date.js";
import { db } from "./db.js";
import { appConfig } from "./config.js";
import type { UsageSnapshot } from "@cursor-agent-web/shared";

type UsageRow = { runs: number; messages: number };

function getOrCreateRow(date: string): UsageRow {
  const existing = db
    .prepare("SELECT runs, messages FROM daily_usage WHERE usage_date = ?")
    .get(date) as UsageRow | undefined;
  if (existing) return existing;
  db.prepare(
    "INSERT INTO daily_usage (usage_date, runs, messages) VALUES (?, 0, 0)",
  ).run(date);
  return { runs: 0, messages: 0 };
}

export function getUsageSnapshot(now = new Date()): UsageSnapshot {
  const date = usageDateKey(now);
  const row = getOrCreateRow(date);
  return {
    date,
    runsUsed: row.runs,
    runsLimit: appConfig.dailyRunLimit,
    messagesUsed: row.messages,
    messagesLimit: appConfig.dailyMessageLimit,
  };
}

export type QuotaBlock =
  | { ok: true }
  | { ok: false; status: 429; error: string };

export function assertWithinQuota(now = new Date()): QuotaBlock {
  const snap = getUsageSnapshot(now);
  if (snap.messagesUsed >= snap.messagesLimit) {
    return {
      ok: false,
      status: 429,
      error: `今日消息已达上限 ${snap.messagesLimit}`,
    };
  }
  if (snap.runsUsed >= snap.runsLimit) {
    return {
      ok: false,
      status: 429,
      error: `今日 Agent runs 已达上限 ${snap.runsLimit}`,
    };
  }
  return { ok: true };
}

export function recordMessageAndRun(now = new Date()) {
  const date = usageDateKey(now);
  getOrCreateRow(date);
  db.prepare(
    `UPDATE daily_usage
     SET messages = messages + 1, runs = runs + 1
     WHERE usage_date = ?`,
  ).run(date);
}

export function resetTodayUsage(now = new Date()) {
  const date = usageDateKey(now);
  db.prepare(
    `INSERT INTO daily_usage (usage_date, runs, messages) VALUES (?, 0, 0)
     ON CONFLICT(usage_date) DO UPDATE SET runs = 0, messages = 0`,
  ).run(date);
}
