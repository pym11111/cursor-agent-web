import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMode, UsageSnapshot } from "@cursor-agent-web/shared";
import { fetchMe, fetchUsage, login, logout, streamChat } from "./api";

type Msg = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
};

export function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [agentId, setAgentId] = useState<string | undefined>();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMe()
      .then(async (me) => {
        setAuthed(me.authed);
        if (me.authed) setUsage(await fetchUsage());
      })
      .catch(() => setAuthed(false))
      .finally(() => setBootstrapping(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      await login(password);
      setAuthed(true);
      setUsage(await fetchUsage());
      setPassword("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onLogout() {
    await logout();
    setAuthed(false);
    setMessages([]);
    setAgentId(undefined);
    setConversationId(undefined);
    setUsage(null);
  }

  function newChat() {
    setMessages([]);
    setAgentId(undefined);
    setConversationId(undefined);
    setError(null);
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setError(null);
    setBusy(true);
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: text },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      await streamChat({
        message: text,
        mode,
        agentId,
        conversationId,
        onEvent: (event) => {
          if (event.type === "meta") {
            if (event.agentId) setAgentId(event.agentId);
            if (event.conversationId) setConversationId(event.conversationId);
          } else if (event.type === "delta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.text }
                  : m,
              ),
            );
          } else if (event.type === "tool") {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "tool",
                content: `tool: ${event.name}`,
              },
            ]);
          } else if (event.type === "error") {
            setError(event.message);
          }
        },
      });
      setUsage(await fetchUsage());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (bootstrapping) {
    return (
      <div className="login-shell">
        <p className="lede">加载中…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="login-shell">
        <div className="login-panel">
          <h1 className="brand">
            Cursor <span>Agent</span>
          </h1>
          <p className="lede">个人算力对话站。输入站点密码进入。</p>
          <form onSubmit={onLogin}>
            <input
              type="password"
              autoFocus
              placeholder="APP_PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="primary" type="submit">
              进入
            </button>
            {loginError ? <p className="error">{loginError}</p> : null}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Cursor Agent</h1>
        <div className="topbar-actions">
          {usage ? (
            <div className="usage">
              runs {usage.runsUsed}/{usage.runsLimit} · msg {usage.messagesUsed}/
              {usage.messagesLimit}
            </div>
          ) : null}
          <div className="mode-toggle">
            <button
              type="button"
              className={mode === "chat" ? "active" : ""}
              onClick={() => setMode("chat")}
              disabled={busy}
            >
              聊天
            </button>
            <button
              type="button"
              className={mode === "agent" ? "active" : ""}
              onClick={() => setMode("agent")}
              disabled={busy}
            >
              编码
            </button>
          </div>
          <button className="ghost" type="button" onClick={newChat} disabled={busy}>
            新会话
          </button>
          <button className="ghost" type="button" onClick={onLogout}>
            退出
          </button>
        </div>
      </header>

      <main className="messages">
        {messages.length === 0 ? (
          <div className="empty">
            {mode === "chat"
              ? "聊天模式：问答为主，提示词会禁止改文件。"
              : "编码模式：Agent 可在 workspace/ 内读写文件、跑工具。"}
          </div>
        ) : (
          messages.map((m) =>
            m.role === "tool" ? (
              <div key={m.id} className="tool-chip">
                {m.content}
              </div>
            ) : (
              <div key={m.id} className={`msg ${m.role}`}>
                <div className="role">{m.role === "user" ? "you" : "agent"}</div>
                <div>{m.content || (busy ? "…" : "")}</div>
              </div>
            ),
          )
        )}
        <div ref={bottomRef} />
      </main>

      <form className="composer" onSubmit={onSend}>
        {error ? <p className="error">{error}</p> : null}
        <div className="composer-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "chat" ? "问点什么…" : "描述要改的代码或任务…"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend(e);
              }
            }}
          />
          <button className="primary" type="submit" disabled={busy || !input.trim()}>
            {busy ? "生成中" : "发送"}
          </button>
        </div>
      </form>
    </div>
  );
}
