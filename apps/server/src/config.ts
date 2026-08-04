import { config } from "dotenv";
import { isAbsolute, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(root, ".env") });

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.includes("...")) return undefined;
  return value;
}

/** 相对路径相对仓库根；绝对路径原样使用 */
function resolvePath(value: string): string {
  return isAbsolute(value) ? value : resolve(root, value);
}

const dataDir = process.env.DATA_DIR
  ? resolvePath(process.env.DATA_DIR)
  : resolve(root, "data");

const databasePath = process.env.DATABASE_PATH
  ? resolvePath(process.env.DATABASE_PATH)
  : resolve(dataDir, "app.db");

const workspace = process.env.AGENT_WORKSPACE
  ? resolvePath(process.env.AGENT_WORKSPACE)
  : resolve(process.env.DATA_DIR ? dataDir : root, "workspace");

const chatWorkspace = process.env.CHAT_WORKSPACE
  ? resolvePath(process.env.CHAT_WORKSPACE)
  : resolve(workspace, "chat");

mkdirSync(dirname(databasePath), { recursive: true });
mkdirSync(chatWorkspace, { recursive: true });

const isProd = process.env.NODE_ENV === "production";
const apiKey = optionalEnv("CURSOR_API_KEY");
const appPassword = optionalEnv("APP_PASSWORD");

if (!apiKey) {
  console.warn("[config] 缺少 CURSOR_API_KEY：服务可启动，但对话不可用");
}
if (!appPassword) {
  console.warn("[config] 缺少 APP_PASSWORD：登录将失败");
}

export const appConfig = {
  root,
  dataDir,
  databasePath,
  isProd,
  // Railway 会注入 PORT；务必使用该端口做健康检查
  port: Number(process.env.PORT || 3001),
  apiKey: apiKey ?? "",
  appPassword: appPassword ?? "",
  modelId: process.env.MODEL_ID || "composer-2.5",
  workspace,
  chatWorkspace,
  webDist: resolve(root, "apps/web/dist"),
  dailyRunLimit: Number(process.env.DAILY_RUN_LIMIT ?? 20),
  dailyMessageLimit: Number(process.env.DAILY_MESSAGE_LIMIT ?? 100),
  sessionCookie: "caw_session",
  corsOrigins: (
    process.env.CORS_ORIGIN ||
    "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export function assertApiReady() {
  if (!appConfig.apiKey) {
    throw new Error("缺少环境变量 CURSOR_API_KEY");
  }
  if (!appConfig.appPassword) {
    throw new Error("缺少环境变量 APP_PASSWORD");
  }
}
