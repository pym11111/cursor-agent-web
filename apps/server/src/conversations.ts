import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import type { ChatMode } from "@cursor-agent-web/shared";

type ConversationRow = {
  id: string;
  agent_id: string | null;
  mode: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export function listConversations(limit = 50) {
  return db
    .prepare(
      `SELECT id, agent_id, mode, title, created_at, updated_at
       FROM conversations
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .all(limit) as ConversationRow[];
}

export function getConversation(id: string) {
  return db
    .prepare(
      `SELECT id, agent_id, mode, title, created_at, updated_at
       FROM conversations WHERE id = ?`,
    )
    .get(id) as ConversationRow | undefined;
}

export function createConversation(mode: ChatMode, title: string) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO conversations (id, agent_id, mode, title, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?)`,
  ).run(id, mode, title.slice(0, 80), now, now);
  return id;
}

export function touchConversation(
  id: string,
  options: { agentId?: string; title?: string } = {},
) {
  const now = new Date().toISOString();
  if (options.agentId) {
    db.prepare(
      `UPDATE conversations SET agent_id = ?, updated_at = ?, title = COALESCE(?, title) WHERE id = ?`,
    ).run(options.agentId, now, options.title ?? null, id);
  } else {
    db.prepare(
      `UPDATE conversations SET updated_at = ?, title = COALESCE(?, title) WHERE id = ?`,
    ).run(now, options.title ?? null, id);
  }
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
) {
  db.prepare(
    `INSERT INTO messages (conversation_id, role, content, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(conversationId, role, content, new Date().toISOString());
}

export function listMessages(conversationId: string) {
  return db
    .prepare(
      `SELECT id, role, content, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY id ASC`,
    )
    .all(conversationId) as Array<{
    id: number;
    role: string;
    content: string;
    created_at: string;
  }>;
}
