import express from "express";
import path from "node:path";
import { Readable } from "node:stream";
import { createTranslationApp } from "./translation-api.mjs";

const ATLAS_ORIGIN = "https://api.atlasacademy.io";
const ALLOWED_ATLAS_PATH = /^\/(nice|basic|raw|info)(\/|$)/;

export function createReaderApp({
  staticRoot,
  localEnvPath,
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  if (!staticRoot) throw new Error("staticRoot is required");
  const app = express();

  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.atlasacademy.io",
        "media-src 'self' blob: https://*.atlasacademy.io",
        "connect-src 'self' https://*.atlasacademy.io",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
    );
    next();
  });

  app.use("/atlas-api", async (request, response) => {
    const upstreamPath = request.originalUrl.slice("/atlas-api".length) || "/";
    if (!["GET", "HEAD"].includes(request.method)) {
      response.status(405).json({ detail: "仅支持读取 Atlas 数据" });
      return;
    }
    if (!upstreamPath.startsWith("/") || upstreamPath.startsWith("//")) {
      response.status(400).json({ detail: "无效的 Atlas 请求路径" });
      return;
    }
    const upstreamUrl = new URL(upstreamPath, ATLAS_ORIGIN);
    if (upstreamUrl.origin !== ATLAS_ORIGIN || !ALLOWED_ATLAS_PATH.test(upstreamUrl.pathname)) {
      response.status(403).json({ detail: "Atlas 请求路径不在允许范围内" });
      return;
    }

    try {
      const upstream = await fetchImpl(upstreamUrl, {
        method: request.method,
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

  app.use("/translation-api", createTranslationApp({ env, localEnvPath, fetchImpl }));

  app.use(express.static(staticRoot, {
    maxAge: "1h",
    setHeaders(response, filePath) {
      if (path.basename(filePath) === "index.html") {
        response.setHeader("Cache-Control", "no-cache");
      }
    },
  }));
  app.use((_request, response) => {
    response.sendFile(path.join(staticRoot, "index.html"));
  });

  return app;
}

export function startReaderServer({ host = "127.0.0.1", port = 4173, ...options } = {}) {
  const app = createReaderApp(options);
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    const fail = (error) => reject(error);
    server.once("error", fail);
    server.once("listening", () => {
      server.off("error", fail);
      const address = server.address();
      const listeningPort = typeof address === "object" && address ? address.port : port;
      resolve({
        app,
        server,
        host,
        port: listeningPort,
        url: `http://${host}:${listeningPort}`,
      });
    });
  });
}
