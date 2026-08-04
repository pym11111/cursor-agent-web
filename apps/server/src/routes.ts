import { Router } from "express";
import { z } from "zod";
import { appConfig } from "./config.js";
import { isAuthed, issueSessionToken, requireAuth } from "./auth.js";
import { initSse } from "./sse.js";
import { streamAgentReply } from "./agent-service.js";
import {
  assertWithinQuota,
  getUsageSnapshot,
  recordMessageAndRun,
  resetTodayUsage,
} from "./usage.js";
import {
  addMessage,
  createConversation,
  getConversation,
  listConversations,
  listMessages,
  touchConversation,
} from "./conversations.js";
import "./db.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    model: appConfig.modelId,
    hasApiKey: Boolean(appConfig.apiKey),
    hasPassword: Boolean(appConfig.appPassword),
    port: appConfig.port,
    limits: {
      dailyRunLimit: appConfig.dailyRunLimit,
      dailyMessageLimit: appConfig.dailyMessageLimit,
    },
  });
});

router.post("/auth/login", (req, res) => {
  const body = z.object({ password: z.string().min(1) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "password 必填" });
    return;
  }
  if (body.data.password !== appConfig.appPassword) {
    res.status(401).json({ error: "密码错误" });
    return;
  }
  res.cookie(appConfig.sessionCookie, issueSessionToken(body.data.password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie(appConfig.sessionCookie);
  res.json({ ok: true });
});

router.get("/auth/me", (req, res) => {
  res.json({ authed: isAuthed(req) });
});

router.get("/usage", requireAuth, (_req, res) => {
  res.json(getUsageSnapshot());
});

router.post("/admin/reset-usage", requireAuth, (_req, res) => {
  // 第一版：已登录即可重置（仅本机/个人站）
  resetTodayUsage();
  res.json(getUsageSnapshot());
});

router.get("/conversations", requireAuth, (_req, res) => {
  res.json({
    items: listConversations().map((c) => ({
      id: c.id,
      agentId: c.agent_id,
      mode: c.mode,
      title: c.title,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })),
  });
});

router.get("/conversations/:id", requireAuth, (req, res) => {
  const id = String(req.params.id);
  const conversation = getConversation(id);
  if (!conversation) {
    res.status(404).json({ error: "会话不存在" });
    return;
  }
  res.json({
    id: conversation.id,
    agentId: conversation.agent_id,
    mode: conversation.mode,
    title: conversation.title,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
    messages: listMessages(conversation.id).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
  });
});

const chatSchema = z.object({
  message: z.string().min(1),
  mode: z.enum(["chat", "agent"]).default("chat"),
  agentId: z.string().optional(),
  conversationId: z.string().optional(),
});

router.post("/chat", requireAuth, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "message 必填" });
    return;
  }

  const quota = assertWithinQuota();
  if (!quota.ok) {
    res.status(quota.status).json({ error: quota.error });
    return;
  }

  const { message, mode } = parsed.data;
  let conversationId = parsed.data.conversationId;
  let agentId = parsed.data.agentId;

  if (conversationId) {
    const existing = getConversation(conversationId);
    if (!existing) {
      res.status(404).json({ error: "会话不存在" });
      return;
    }
    agentId = agentId ?? existing.agent_id ?? undefined;
  } else {
    conversationId = createConversation(mode, message);
  }

  addMessage(conversationId, "user", message);
  // 进入 SSE 前先占额度，避免流式中途超限难回滚
  recordMessageAndRun();

  initSse(res);

  const result = await streamAgentReply({
    res,
    message,
    mode,
    agentId,
    conversationId,
  });

  if (result.agentId) {
    touchConversation(conversationId, {
      agentId: result.agentId,
      title: message,
    });
  } else {
    touchConversation(conversationId, { title: message });
  }

  if (result.assistantText) {
    addMessage(conversationId, "assistant", result.assistantText);
  }

  res.end();
});
