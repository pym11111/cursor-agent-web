import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { appConfig } from "./config.js";
import { router } from "./routes.js";

console.log("[boot] starting", {
  port: appConfig.port,
  nodeEnv: process.env.NODE_ENV,
  dataDir: appConfig.dataDir,
  hasApiKey: Boolean(appConfig.apiKey),
  hasPassword: Boolean(appConfig.appPassword),
});

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api", router);

const webDist = appConfig.webDist;
if (existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(join(webDist, "index.html"));
  });
  console.log(`已托管前端静态资源: ${webDist}`);
} else {
  console.warn(`[boot] 未找到前端产物: ${webDist}`);
}

// Railway 要求监听 0.0.0.0，并使用注入的 PORT
app.listen(appConfig.port, "0.0.0.0", () => {
  console.log(`服务已启动: 0.0.0.0:${appConfig.port}`);
  console.log(`健康检查: GET /api/health`);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});
