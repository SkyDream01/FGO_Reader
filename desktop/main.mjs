import {
  app,
  BrowserWindow,
  dialog,
  shell,
} from "electron";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { startReaderServer } from "../server/reader-app.mjs";

const APP_ORIGIN = "http://127.0.0.1:4173";
const APP_PORT = 4173;
const DOCUMENTATION_URL = new URL(
  "https://github.com/SkyDream01/FGO_Reader/blob/main/docs/custom-scripts.md",
);
const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleRoot, "..");
const smokeTest = process.argv.includes("--smoke-test");

let mainWindow = null;
let runningServer = null;

function portableExecutableDirectory() {
  const builderDirectory = process.env.PORTABLE_EXECUTABLE_DIR?.trim();
  if (builderDirectory) return path.resolve(builderDirectory);
  if (app.isPackaged) return path.dirname(process.execPath);
  return path.join(app.getPath("temp"), "FGO-Chronicle-Reader-Dev");
}

const portableRoot = portableExecutableDirectory();
const dataRoot = path.join(portableRoot, "FGO-Chronicle-Reader-Data");
app.setPath("userData", dataRoot);
app.setPath("sessionData", path.join(dataRoot, "Session"));

function verifyPortableDataDirectory() {
  mkdirSync(dataRoot, { recursive: true });
  const probe = path.join(dataRoot, `.write-test-${process.pid}`);
  writeFileSync(probe, "ok", { encoding: "utf8", flag: "wx" });
  rmSync(probe, { force: true });
}

function isAllowedExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.origin === DOCUMENTATION_URL.origin
      && url.pathname.startsWith("/SkyDream01/FGO_Reader/");
  } catch {
    return false;
  }
}

function openAllowedExternalUrl(value) {
  if (isAllowedExternalUrl(value)) void shell.openExternal(value);
}

async function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#050a12",
    icon: app.isPackaged ? process.execPath : path.join(projectRoot, "build", "icon.ico"),
    title: "FGO Chronicle Reader",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openAllowedExternalUrl(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(`${APP_ORIGIN}/`)) return;
    event.preventDefault();
    openAllowedExternalUrl(url);
  });
  window.once("ready-to-show", () => {
    window.show();
    if (smokeTest) {
      console.log("FGO_READER_SMOKE_READY");
      setTimeout(() => app.quit(), 1_000);
    }
  });
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  await window.loadURL(APP_ORIGIN);
  mainWindow = window;
}

async function startApplication() {
  try {
    verifyPortableDataDirectory();
  } catch (error) {
    dialog.showErrorBox(
      "便携数据目录不可写",
      [
        `无法在以下位置创建数据目录：\n${dataRoot}`,
        "请把 EXE 移到当前用户可写的文件夹后重试。",
        error instanceof Error ? error.message : String(error),
      ].join("\n\n"),
    );
    app.quit();
    return;
  }

  const localEnvPath = path.join(dataRoot, ".env.local");
  if (existsSync(localEnvPath)) loadEnvFile(localEnvPath);

  try {
    runningServer = await startReaderServer({
      host: "127.0.0.1",
      port: APP_PORT,
      staticRoot: path.join(app.getAppPath(), "dist"),
      localEnvPath,
      env: process.env,
    });
  } catch (error) {
    const detail = error?.code === "EADDRINUSE"
      ? `端口 ${APP_PORT} 已被占用。请关闭另一个阅读器实例或占用该端口的程序。`
      : error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("FGO Chronicle Reader 无法启动", detail);
    app.quit();
    return;
  }

  await createMainWindow();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    runningServer?.server.close();
    runningServer = null;
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId("io.github.skydream01.fgoreader");
    await startApplication();
  }).catch((error) => {
    dialog.showErrorBox(
      "FGO Chronicle Reader 无法启动",
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  });
}
