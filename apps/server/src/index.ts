import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { appConfig } from "./config.js";
import { router } from "./routes.js";

const app = express();

app.use(
  cors({
    origin: appConfig.corsOrigins,
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
}

app.listen(appConfig.port, () => {
  console.log(`服务已启动: http://localhost:${appConfig.port}`);
  console.log(`健康检查: GET /api/health`);
  console.log(`dataDir: ${appConfig.dataDir}`);
  console.log(`workspace: ${appConfig.workspace}`);
});
