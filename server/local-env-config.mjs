import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const OPENAI_ENV_KEYS = [
  "OPENAI_COMPAT_BASE_URL",
  "OPENAI_COMPAT_API_KEY",
  "OPENAI_COMPAT_MODEL",
  "OPENAI_COMPAT_ALLOW_NO_AUTH",
];

const MANAGED_ENV_HEADING = "# OpenAI-compatible Chat Completions（由网页设置管理）";

function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBoolean(value) {
  return String(value).trim().toLowerCase() === "true";
}

function serializeEnvValue(value) {
  return JSON.stringify(String(value));
}

function replaceManagedEnvValues(source, values) {
  const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalLineEnding = source.endsWith("\n");
  const lines = source ? source.replace(/\r\n/g, "\n").split("\n") : [];
  if (hadFinalLineEnding) lines.pop();

  const managed = new Set(OPENAI_ENV_KEYS);
  const written = new Set();
  const output = [];

  for (const line of lines) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    const key = match?.[1];
    if (!key || !managed.has(key)) {
      output.push(line);
      continue;
    }
    if (written.has(key)) continue;
    output.push(`${key}=${serializeEnvValue(values[key] ?? "")}`);
    written.add(key);
  }

  const missing = OPENAI_ENV_KEYS.filter((key) => !written.has(key));
  if (missing.length) {
    if (output.length && output.at(-1)?.trim()) output.push("");
    output.push(MANAGED_ENV_HEADING);
    for (const key of missing) output.push(`${key}=${serializeEnvValue(values[key] ?? "")}`);
  }

  return `${output.join(lineEnding)}${lineEnding}`;
}

async function readEnvSource(envFilePath) {
  try {
    return await readFile(envFilePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function writeEnvSource(envFilePath, source) {
  await mkdir(path.dirname(envFilePath), { recursive: true });
  const temporaryPath = `${envFilePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, source, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, envFilePath);
}

export function publicLocalOpenAiConfig(env, editable = false) {
  return {
    editable,
    fileName: ".env.local",
    baseUrl: nonEmpty(env.OPENAI_COMPAT_BASE_URL) ?? "",
    model: nonEmpty(env.OPENAI_COMPAT_MODEL) ?? "",
    allowNoAuth: readBoolean(env.OPENAI_COMPAT_ALLOW_NO_AUTH),
    apiKeyConfigured: Boolean(nonEmpty(env.OPENAI_COMPAT_API_KEY)),
  };
}

export async function writeLocalOpenAiConfig({ env, envFilePath, values }) {
  const source = await readEnvSource(envFilePath);
  const nextSource = replaceManagedEnvValues(source, values);
  await writeEnvSource(envFilePath, nextSource);

  for (const key of OPENAI_ENV_KEYS) env[key] = values[key] ?? "";
  return publicLocalOpenAiConfig(env, true);
}

export async function clearLocalOpenAiConfig({ env, envFilePath }) {
  return writeLocalOpenAiConfig({
    env,
    envFilePath,
    values: {
      OPENAI_COMPAT_BASE_URL: "",
      OPENAI_COMPAT_API_KEY: "",
      OPENAI_COMPAT_MODEL: "",
      OPENAI_COMPAT_ALLOW_NO_AUTH: "false",
    },
  });
}
