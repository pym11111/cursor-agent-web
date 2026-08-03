import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(root, ".env") });

/**
 * Phase 0 健康检查：确认环境变量与进程能启动。
 * Phase 1 会在此基础上接入 @cursor/sdk。
 */
const required = ["CURSOR_API_KEY", "APP_PASSWORD"] as const;

function main() {
  const missing = required.filter((key) => !process.env[key] || process.env[key]?.includes("..."));
  const port = Number(process.env.PORT ?? 3001);

  console.log("=== cursor-agent-web 环境检查 ===");
  console.log(`Node: ${process.version}`);
  console.log(`CWD root: ${root}`);
  console.log(`PORT: ${port}`);
  console.log(`MODEL_ID: ${process.env.MODEL_ID ?? "(未设置，将默认 composer-2.5)"}`);
  console.log(`AGENT_WORKSPACE: ${process.env.AGENT_WORKSPACE ?? "./workspace"}`);
  console.log(`DAILY_RUN_LIMIT: ${process.env.DAILY_RUN_LIMIT ?? "20"}`);
  console.log(`DAILY_MESSAGE_LIMIT: ${process.env.DAILY_MESSAGE_LIMIT ?? "100"}`);

  if (missing.length) {
    console.log("");
    console.log("还缺以下配置（编辑项目根目录 .env）：");
    for (const key of missing) console.log(`  - ${key}`);
    console.log("");
    console.log("创建 CURSOR_API_KEY（我无法代你创建）：");
    console.log("  1. 打开 https://cursor.com/dashboard/integrations");
    console.log("  2. 找到 User API Keys，创建一把新 Key");
    console.log("  3. 粘贴到 C:\\Users\\THS\\cursor-agent-web\\.env 的 CURSOR_API_KEY=");
    console.log("  4. 同时把 APP_PASSWORD 改成你自己的登录密码");
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("环境变量齐全。下一步 Phase 1：npm run sdk:smoke -w @cursor-agent-web/server");
}

main();
