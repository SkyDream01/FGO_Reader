import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createTranslationApp } from "./server/translation-api.mjs";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const localEnvPath = path.join(root, ".env.local");

if (existsSync(localEnvPath)) loadEnvFile(localEnvPath);
const port = Number(process.env.PORT || 4173);

app.use("/atlas-api", async (request, response) => {
  const upstreamPath = request.originalUrl.slice("/atlas-api".length) || "/";
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.status(405).json({ detail: "仅支持读取 Atlas 数据" });
    return;
  }
  if (!upstreamPath.startsWith("/") || upstreamPath.startsWith("//")) {
    response.status(400).json({ detail: "无效的 Atlas 请求路径" });
    return;
  }
  const upstreamUrl = new URL(upstreamPath, "https://api.atlasacademy.io");
  const allowedPath = /^\/(nice|basic|raw|info)(\/|$)/.test(upstreamUrl.pathname);
  if (upstreamUrl.origin !== "https://api.atlasacademy.io" || !allowedPath) {
    response.status(403).json({ detail: "Atlas 请求路径不在允许范围内" });
    return;
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        accept: request.headers.accept || "application/json",
        "user-agent": "FGO-Chronicle-Reader/0.1",
      },
    });

    response.status(upstream.status);
    for (const header of ["content-type", "cache-control", "etag", "last-modified"]) {
      const value = upstream.headers.get(header);
      if (value) response.setHeader(header, value);
    }
    response.setHeader("Access-Control-Allow-Origin", "*");
    if (request.method === "HEAD" || !upstream.body) {
      response.end();
      return;
    }
    Readable.fromWeb(upstream.body).pipe(response);
  } catch (error) {
    response.status(502).json({
      detail: "Atlas Academy 暂时无法访问",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.use("/translation-api", createTranslationApp({ env: process.env, localEnvPath }));

app.use(express.static(path.join(root, "dist"), {
  maxAge: "1h",
  setHeaders(response, filePath) {
    // The HTML shell references hash-named assets. It must be revalidated so a
    // newly built shell can point browsers at the latest asset bundle.
    if (path.basename(filePath) === "index.html") {
      response.setHeader("Cache-Control", "no-cache");
    }
  },
}));
app.use((_request, response) => {
  response.sendFile(path.join(root, "dist", "index.html"));
});

app.listen(port, "127.0.0.1", () => {
  console.log(`FGO Chronicle Reader: http://127.0.0.1:${port}`);
});
