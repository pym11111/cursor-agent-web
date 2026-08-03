import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, CursorAgentError } from "@cursor/sdk";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(root, ".env") });

/**
 * Phase 1：用 Cursor SDK 发一次最短对话，验证本账号算力可调通。
 */
async function main() {
  const apiKey = process.env.CURSOR_API_KEY;
  const modelId = process.env.MODEL_ID || "composer-2.5";
  const cwd = resolve(root, process.env.AGENT_WORKSPACE || "./workspace");

  if (!apiKey || apiKey.includes("...")) {
    console.error("缺少有效 CURSOR_API_KEY，先跑 npm run env:check");
    process.exit(1);
  }

  console.log("=== Phase 1 SDK 冒烟 ===");
  console.log(`model: ${modelId}`);
  console.log(`cwd: ${cwd}`);
  console.log("正在创建 Agent...");

  try {
    await using agent = await Agent.create({
      apiKey,
      model: { id: modelId },
      local: { cwd },
    });

    console.log(`agentId: ${agent.agentId}`);
    const run = await agent.send("用一句话介绍你自己，不要改任何文件。");
    console.log(`runId: ${run.id}`);
    console.log("--- 流式输出 ---");

    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text") process.stdout.write(block.text);
        }
      }
    }

    const result = await run.wait();
    console.log("\n--- 结束 ---");
    console.log(`status: ${result.status}`);

    if (result.status === "error") {
      console.error("Run 已启动但中途失败。检查 Dashboard / 账号额度。");
      process.exit(2);
    }

    console.log("Phase 1 通过：Cursor SDK 本机调用成功。");
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error("启动失败（鉴权/配置/网络）：", err.message);
      console.error(`retryable=${err.isRetryable}`);
      process.exit(1);
    }
    throw err;
  }
}

main();
