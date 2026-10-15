import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { compileFgoScript } from "../lib/scriptParser";
import { ScriptExecutor } from "./executor";

const corpus = process.env.FGO_CORPUS_DIR;
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => item.isDirectory() ? files(join(directory, item.name)) : item.name.endsWith(".txt") ? [join(directory, item.name)] : []);
}
it.skipIf(!corpus)("compiles the complete local reverse-engineering corpus", () => {
  const scripts = files(corpus!);
  const failures: Array<{ file: string; errors: unknown }> = [];
  let messages = 0, choices = 0;
  for (const file of scripts) {
    const program = compileFgoScript(readFileSync(file, "utf8"), file);
    const errors = program.diagnostics.filter((entry) => entry.severity === "error");
    if (errors.length) failures.push({ file, errors });
    messages += program.messageCatalog.length; choices += program.choiceCatalog.length;
  }
  console.log(JSON.stringify({ scripts: scripts.length, messages, choices, failures: failures.length }));
  expect(scripts.length).toBeGreaterThan(0);
  expect(failures).toEqual([]);
}, 120_000);

it.skipIf(!corpus || !process.env.FGO_CORPUS_REPLAY)("replays every local script without crashing or remaining in a permanent resource wait", () => {
  const failures: Array<{ file: string; reason: string; position?: number }> = [];
  const diagnostics = new Map<string, number>(); let completed = 0, branches = 0;
  for (const file of files(corpus!)) {
    try {
      const program = compileFgoScript(readFileSync(file, "utf8"), file);
      const executor = new ScriptExecutor(program, { masterName: "御主", masterGender: "male", textSpeedMs: 0, reduceMotion: true });
      executor.start(); const choices = new Map<string, number>();
      let steps = 0;
      for (; steps < 20_000 && executor.getSnapshot().phase !== "ended"; steps++) {
        const state = executor.getSnapshot();
        if (state.choice) { const visit = choices.get(state.choice.key) ?? 0; choices.set(state.choice.key, visit + 1); executor.selectChoice(visit % state.choice.options.length); branches++; }
        else if (state.phase === "wait" && state.waitKind === "completion") { executor.tick(1e9); }
        else { executor.tap(); executor.tick(1e9); }
      }
      if (steps === 20_000) failures.push({ file, reason: "replay budget exceeded (loop or permanent wait)", position: executor.getSnapshot().position });
      else if (executor.unknownCommands.has("control_flow")) failures.push({ file, reason: "control flow guard terminated the script", position: executor.getSnapshot().position });
      else completed++;
      for (const tag of executor.unknownCommands.keys()) diagnostics.set(tag, (diagnostics.get(tag) ?? 0) + 1);
    } catch (error) { failures.push({ file, reason: String(error) }); }
  }
  console.log(JSON.stringify({ completed, branches, unknown: Object.fromEntries(diagnostics), failures }));
  if (process.env.FGO_CORPUS_REPORT) writeFileSync(process.env.FGO_CORPUS_REPORT, JSON.stringify({ scripts: files(corpus!).length, completed, branches, unknown: Object.fromEntries(diagnostics), failures }, null, 2));
  expect(failures).toEqual([]);
}, 240_000);
