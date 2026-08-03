import { DatabaseSync } from "node:sqlite";
import { appConfig } from "./config.js";

export const db = new DatabaseSync(appConfig.databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS daily_usage (
    usage_date TEXT PRIMARY KEY,
    runs INTEGER NOT NULL DEFAULT 0,
    messages INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    mode TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );
`);
