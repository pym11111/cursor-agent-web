export type ChatMode = "chat" | "agent";

export type SseEvent =
  | {
      type: "meta";
      agentId: string;
      runId: string;
      conversationId?: string;
    }
  | { type: "delta"; text: string }
  | { type: "tool"; name: string; detail?: string }
  | { type: "done"; status: string }
  | { type: "error"; message: string; retryable?: boolean };

export type UsageSnapshot = {
  date: string;
  runsUsed: number;
  runsLimit: number;
  messagesUsed: number;
  messagesLimit: number;
};