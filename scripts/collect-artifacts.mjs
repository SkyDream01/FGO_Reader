import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const releaseDirectory = path.join(root, "release");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const apkSource = path.join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const apkName = `FGO-Chronicle-Reader-${packageJson.version}-android.apk`;

await mkdir(releaseDirectory, { recursive: true });
try {
  await copyFile(apkSource, path.join(releaseDirectory, apkName));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const artifacts = (await readdir(releaseDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(?:apk|exe)$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();

const checksums = [];
for (const artifact of artifacts) {
  const contents = await readFile(path.join(releaseDirectory, artifact));
  checksums.push(`${createHash("sha256").update(contents).digest("hex")}  ${artifact}`);
}
await writeFile(
  path.join(releaseDirectory, "SHA256SUMS.txt"),
  checksums.length ? `${checksums.join("\n")}\n` : "",
  "utf8",
);

console.log(`Collected ${artifacts.length} artifact(s) in ${releaseDirectory}`);
