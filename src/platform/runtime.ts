import {
  Capacitor,
  SystemBars,
  SystemBarsStyle,
} from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import {
  Directory,
  Encoding,
  Filesystem,
} from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const ATLAS_ORIGIN = "https://api.atlasacademy.io";
const ALLOWED_ATLAS_PATH = /^\/(nice|basic|raw|info)(\/|$)/;

export const isAndroidNative = () => (
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
);

export function resolveRuntimeRequestUrl(
  input: RequestInfo | URL,
  androidNative = isAndroidNative(),
) {
  const value = input instanceof Request ? input.url : String(input);
  if (!androidNative || !value.startsWith("/atlas-api")) return value;

  const upstreamPath = value.slice("/atlas-api".length) || "/";
  if (!upstreamPath.startsWith("/") || upstreamPath.startsWith("//")) {
    throw new Error("无效的 Atlas 请求路径");
  }
  const upstreamUrl = new URL(upstreamPath, ATLAS_ORIGIN);
  if (upstreamUrl.origin !== ATLAS_ORIGIN || !ALLOWED_ATLAS_PATH.test(upstreamUrl.pathname)) {
    throw new Error("Atlas 请求路径不在允许范围内");
  }
  return upstreamUrl.toString();
}

export function runtimeFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(resolveRuntimeRequestUrl(input), init);
}

export async function exportTextFile(fileName: string, content: string, mimeType: string) {
  if (isAndroidNative()) {
    const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "-");
    const result = await Filesystem.writeFile({
      path: `exports/${safeName}`,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({
      title: fileName,
      text: "FGO 剧情阅读器导出文件",
      url: result.uri,
      dialogTitle: "保存或分享翻译母本",
    });
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

let nativeFullscreen = isAndroidNative();

export async function toggleApplicationFullscreen() {
  if (isAndroidNative()) {
    nativeFullscreen = !nativeFullscreen;
    if (nativeFullscreen) await SystemBars.hide();
    else await SystemBars.show();
    return nativeFullscreen;
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return false;
  }
  await document.documentElement.requestFullscreen();
  return true;
}

export async function leaveApplicationFullscreen() {
  if (isAndroidNative()) {
    // The Android archive itself is designed as an immersive landscape app.
    // Leaving the reader therefore restores the app default instead of bars.
    nativeFullscreen = true;
    await SystemBars.hide();
    return;
  }
  if (document.fullscreenElement) await document.exitFullscreen();
}

export async function openExternalUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("只允许打开 HTTPS 外链");
  if (isAndroidNative()) {
    await Browser.open({ url: parsed.toString() });
    return;
  }
  window.open(parsed.toString(), "_blank", "noopener,noreferrer");
}

type BackHandler = () => boolean | Promise<boolean>;
const backHandlers: BackHandler[] = [];
let runtimeInitialized = false;

export function registerAndroidBackHandler(handler: BackHandler) {
  if (!isAndroidNative()) return () => undefined;
  backHandlers.push(handler);
  return () => {
    const index = backHandlers.lastIndexOf(handler);
    if (index >= 0) backHandlers.splice(index, 1);
  };
}

export function initializeRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  document.documentElement.dataset.runtime = isAndroidNative() ? "android" : "web";
  if (!isAndroidNative()) return;

  nativeFullscreen = true;
  void SystemBars.setStyle({ style: SystemBarsStyle.Dark })
    .then(() => SystemBars.hide())
    .catch(() => undefined);
  void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
    if (isActive && nativeFullscreen) void SystemBars.hide().catch(() => undefined);
  });
  void CapacitorApp.addListener("backButton", async () => {
    for (let index = backHandlers.length - 1; index >= 0; index -= 1) {
      if (await backHandlers[index]()) return;
    }
    await CapacitorApp.exitApp();
  });
}
