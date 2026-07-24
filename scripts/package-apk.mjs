import { existsSync, readdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const localToolchain = path.join(root, ".android-toolchain");
const localJdkRoot = path.join(localToolchain, "jdk");
const localSdkRoot = path.join(localToolchain, "sdk");

const localJdks = existsSync(localJdkRoot)
  ? readdirSync(localJdkRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(localJdkRoot, entry.name))
    .sort()
  : [];

const env = { ...process.env };
if (localJdks.length > 0) env.JAVA_HOME = localJdks.at(-1);
if (existsSync(localSdkRoot)) {
  env.ANDROID_HOME = localSdkRoot;
  env.ANDROID_SDK_ROOT = localSdkRoot;
}
if (existsSync(localToolchain)) {
  env.GRADLE_USER_HOME = path.join(localToolchain, "gradle-home");
}

if (!env.JAVA_HOME) {
  throw new Error("未找到 JDK。请安装 JDK 21，或在 .android-toolchain/jdk 中放置便携 JDK。");
}
if (!env.ANDROID_HOME) {
  throw new Error("未找到 Android SDK。请设置 ANDROID_HOME，或初始化 .android-toolchain/sdk。");
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} 执行失败，退出码 ${result.status ?? 1}`);
  }
}

function runScript(command, args, cwd = root) {
  if (process.platform !== "win32") {
    run(command, args, cwd);
    return;
  }
  run(process.env.ComSpec || "cmd.exe", ["/d", "/c", command, ...args], cwd);
}

async function startLocalMavenProxy() {
  if (process.platform !== "win32" || env.FGO_MAVEN_PROXY_URL) return null;

  const child = spawn(process.execPath, [path.join(root, "scripts", "android-maven-proxy.mjs")], {
    cwd: root,
    env: { ...env, FGO_MAVEN_PROXY_PORT: "4873" },
    stdio: ["ignore", "pipe", "inherit"],
    windowsHide: true,
  });
  child.stdout.setEncoding("utf8");

  const proxyUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("本机 Maven 转发器启动超时")), 10_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`本机 Maven 转发器提前退出：${code}`));
    });
    child.stdout.on("data", (chunk) => {
      const match = chunk.match(/FGO_MAVEN_PROXY_READY=(http:\/\/127\.0\.0\.1:\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve(match[1]);
    });
  });
  env.FGO_MAVEN_PROXY_URL = proxyUrl;
  return child;
}

let mavenProxy = null;
try {
  mavenProxy = await startLocalMavenProxy();
  run(process.execPath, [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-b"]);
  run(process.execPath, [path.join(root, "node_modules", "vite", "bin", "vite.js"), "build"]);
  run(process.execPath, [path.join(root, "node_modules", "@capacitor", "cli", "bin", "capacitor"), "sync", "android"]);
  runScript(
  process.platform === "win32" ? "gradlew.bat" : "./gradlew",
    ["assembleRelease", "--no-daemon"],
    path.join(root, "android"),
  );
  run(process.execPath, [path.join(root, "scripts", "collect-artifacts.mjs")]);
} finally {
  mavenProxy?.kill();
}
