import { config } from "dotenv";
import { isAbsolute, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(root, ".env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.includes("...")) {
    throw new Error(`缺少环境变量 ${name}，请检查根目录 .env`);
  }
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

export const appConfig = {
  root,
  dataDir,
  databasePath,
  isProd,
  port: Number(process.env.PORT ?? 3001),
  apiKey: requireEnv("CURSOR_API_KEY"),
  appPassword: requireEnv("APP_PASSWORD"),
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
