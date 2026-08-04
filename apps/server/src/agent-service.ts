import type { Response } from "express";
import type { ChatMode } from "@cursor-agent-web/shared";
import { appConfig, assertApiReady } from "./config.js";
import { sendSse } from "./sse.js";

const chatPrefix =
  "你是对话助手。只回答用户问题，不要创建、修改或删除任何文件，不要执行命令。\n\n用户：";

type SdkModule = typeof import("@cursor/sdk");
type SdkAgent = Awaited<ReturnType<SdkModule["Agent"]["create"]>>;

const liveAgents = new Map<string, SdkAgent>();

export type StreamResult = {
  agentId?: string;
  status?: string;
  assistantText: string;
  ok: boolean;
};

async function loadSdk(): Promise<SdkModule> {
  return import("@cursor/sdk");
}

async function acquireAgent(options: {
  agentId?: string;
  cwd: string;
}): Promise<{ agent: SdkAgent; resumed: boolean }> {
  assertApiReady();
  const { Agent } = await loadSdk();
  const { agentId, cwd } = options;

  if (agentId && liveAgents.has(agentId)) {
    return { agent: liveAgents.get(agentId)!, resumed: true };
  }

  if (agentId) {
    try {
      const agent = await Agent.resume(agentId, { apiKey: appConfig.apiKey });
      liveAgents.set(agent.agentId, agent);
      return { agent, resumed: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/not found/i.test(msg)) throw err;
      console.warn(`[agent] resume 失败，新建 Agent: ${msg}`);
    }
  }

  const agent = await Agent.create({
    apiKey: appConfig.apiKey,
    model: { id: appConfig.modelId },
    local: { cwd },
  });
  liveAgents.set(agent.agentId, agent);
  return { agent, resumed: false };
}

export async function streamAgentReply(options: {
  res: Response;
  message: string;
  mode: ChatMode;
  agentId?: string;
  conversationId?: string;
}): Promise<StreamResult> {
  const { res, message, mode, agentId, conversationId } = options;
  const prompt = mode === "chat" ? `${chatPrefix}${message}` : message;
  const cwd = mode === "chat" ? appConfig.chatWorkspace : appConfig.workspace;

  let assistantText = "";

  try {
    const { agent } = await acquireAgent({ agentId, cwd });
    const run = await agent.send(prompt);
    sendSse(res, {
      type: "meta",
      agentId: agent.agentId,
      runId: run.id,
      conversationId,
    });

    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            assistantText += block.text;
            sendSse(res, { type: "delta", text: block.text });
          }
        }
      } else if (event.type === "tool_call" && mode === "agent") {
        const name =
          "name" in event
            ? String((event as { name?: string }).name ?? "tool")
            : "tool";
        sendSse(res, { type: "tool", name });
      }
    }

    const result = await run.wait();
    sendSse(res, { type: "done", status: result.status });
    return {
      ok: result.status !== "error",
      agentId: agent.agentId,
      status: result.status,
      assistantText,
    };
  } catch (err) {
    const { CursorAgentError } = await loadSdk().catch(() => ({
      CursorAgentError: undefined,
    }));
    if (CursorAgentError && err instanceof CursorAgentError) {
      sendSse(res, {
        type: "error",
        message: err.message,
        retryable: err.isRetryable,
      });
      return { ok: false, assistantText };
    }
    const messageText = err instanceof Error ? err.message : String(err);
    sendSse(res, { type: "error", message: messageText });
    return { ok: false, assistantText };
  }
}
