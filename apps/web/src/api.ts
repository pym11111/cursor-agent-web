import type { ChatMode, SseEvent, UsageSnapshot } from "@cursor-agent-web/shared";

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `请求失败 (${res.status})`,
    );
  }
  return data;
}

export async function fetchMe(): Promise<{ authed: boolean }> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  return parseJson(res);
}

export async function login(password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  await parseJson(res);
}

export async function logout(): Promise<void> {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  await parseJson(res);
}

export async function fetchUsage(): Promise<UsageSnapshot> {
  const res = await fetch("/api/usage", { credentials: "include" });
  return parseJson(res);
}

export async function streamChat(options: {
  message: string;
  mode: ChatMode;
  agentId?: string;
  conversationId?: string;
  onEvent: (event: SseEvent) => void;
}): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: options.message,
      mode: options.mode,
      agentId: options.agentId,
      conversationId: options.conversationId,
    }),
  });

  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (!res.body) throw new Error("浏览器不支持流式响应");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("data:"));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      options.onEvent(JSON.parse(raw) as SseEvent);
    }
  }
}
