import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { startReaderServer } from "./server/reader-app.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const localEnvPath = path.join(root, ".env.local");

if (existsSync(localEnvPath)) loadEnvFile(localEnvPath);
const port = Number(process.env.PORT || 4173);

try {
  const running = await startReaderServer({
    host: "127.0.0.1",
    port,
    staticRoot: path.join(root, "dist"),
    localEnvPath,
    env: process.env,
  });
  console.log(`FGO Chronicle Reader: ${running.url}`);
} catch (error) {
  console.error("FGO Chronicle Reader failed to start:", error);
  process.exitCode = 1;
}
