import { readFile, writeFile } from "node:fs/promises";

// Recognition is independent of browser implementation coverage. Supplements
// correct semantics; dispatcher spellings are preserved byte for byte.
const root = new URL("../", import.meta.url);
const source = JSON.parse(await readFile(new URL("docs/out/command_params.json", root), "utf8"));
const names = Object.keys(source).sort();
if (names.length !== 366) throw new Error("逆向命令表应包含 366 条命令");
await writeFile(new URL("src/adv/commandNames.json", root), `${JSON.stringify(names, null, 2)}\n`);
console.log(`已生成 ${names.length} 条大小写敏感的 ADV 命令名`);
