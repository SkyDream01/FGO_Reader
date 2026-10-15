import { afterEach, expect, it, vi } from "vitest";
import { AudioChannels, AudioContinuationPool } from "./audio";

class FakeAudio {
  static entries: FakeAudio[] = [];
  volume = 1; loop = false; ended = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => undefined);
  pause = vi.fn();
  constructor(public src: string) { FakeAudio.entries.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); FakeAudio.entries = []; });
it("preserves scripted volume through mute/unmute and removes ended sounds from waits", () => {
  vi.stubGlobal("Audio", FakeAudio);
  const channels = new AudioChannels("JP", () => "test.wav");
  channels.setBaseVolume(0.5); channels.setUnlocked(true);
  channels.handle({ kind: "play", channel: "se", name: "se1", volume: 0.4 });
  const audio = FakeAudio.entries[0];
  expect(audio.volume).toBeCloseTo(0.2); expect(channels.isBusy("se", "se1")).toBe(true);
  channels.setMuted(true); expect(audio.volume).toBe(0);
  channels.setMuted(false); expect(audio.volume).toBeCloseTo(0.2);
  audio.ended = true; audio.onended?.(); expect(channels.isBusy("se")).toBe(false);
});
it("fades volume on the animation clock and does not leave unresolved audio waits", () => {
  vi.stubGlobal("Audio", FakeAudio);
  const channels = new AudioChannels("JP", (_region, _channel, name) => name === "missing" ? null : "test.wav");
  channels.handle({ kind: "play", channel: "se", name: "missing" }); expect(channels.isBusy("se")).toBe(false);
  channels.handle({ kind: "play", channel: "se", name: "se1", volume: 1 });
  channels.handle({ kind: "volume", channel: "se", name: "se1", volume: 0, duration: 1 });
  channels.tick(500); expect(FakeAudio.entries[0].volume).toBeCloseTo(0.5);
  channels.tick(500); expect(FakeAudio.entries[0].volume).toBe(0);
  channels.stopAll(); expect(channels.isBusy("se")).toBe(false);
});
it("addresses cue files in native order and replaces matching continuation ids", () => {
  vi.stubGlobal("Audio", FakeAudio);
  const resolve = vi.fn((_region, _channel, name: string) => name === "Se/bank/cue" ? "cue.wav" : null);
  const channels = new AudioChannels("JP", resolve);
  channels.handle({ kind: "play", channel: "se", sheet: "bank", name: "cue", continueId: 7 });
  channels.handle({ kind: "play", channel: "se", sheet: "bank", name: "cue", continueId: 7 });
  expect(resolve.mock.calls.map(call => call[2])).toEqual(["Se/bank/cue", "Se/bank/cue"]);
  expect(FakeAudio.entries[0].pause).toHaveBeenCalled();
  channels.handle({ kind: "volume", channel: "se", name: "unused", continueId: 7, volume: 0.4 });
  expect(FakeAudio.entries[1].volume).toBeCloseTo(0.4);
  channels.handle({ kind: "stop", channel: "se", continueId: 7, fadeOut: 1 });
  channels.tick(500); expect(FakeAudio.entries[1].volume).toBeCloseTo(0.2); expect(channels.isBusy("se")).toBe(true);
  channels.tick(500); expect(channels.isBusy("se")).toBe(false);
});
it("transfers a continuing element between scripts without restarting its playback", () => {
  vi.stubGlobal("Audio", FakeAudio); const pool = new AudioContinuationPool();
  const first = new AudioChannels("JP", () => "test.wav"); first.setUnlocked(true);
  first.handle({ kind: "play", channel: "se", name: "ambient", continueId: 1, loop: true });
  const element = FakeAudio.entries[0]; first.saveContinuations(pool); first.dispose();
  expect(element.pause).not.toHaveBeenCalled();
  const next = new AudioChannels("JP"); next.restoreContinuations(pool); expect(FakeAudio.entries).toHaveLength(1); expect(next.isBusy("se", "ambient")).toBe(true);
  next.handle({ kind: "stop", channel: "se", continueId: 1 }); expect(element.pause).toHaveBeenCalled();
});
it("waits for the current SE handle without being trapped by older loops or the continuation pool", () => {
  vi.stubGlobal("Audio", FakeAudio); const channels = new AudioChannels("JP", () => "test.wav");
  channels.handle({ kind: "play", channel: "se", name: "ambient", loop: true });
  channels.handle({ kind: "play", channel: "se", name: "blip" });
  channels.handle({ kind: "play", channel: "se", name: "continued", continueId: 2, loop: true });
  expect(channels.isScriptBusy("se")).toBe(true);
  FakeAudio.entries[1].ended = true; FakeAudio.entries[1].onended?.();
  expect(channels.isBusy("se")).toBe(true); expect(channels.isScriptBusy("se")).toBe(false);
});
it("preserves continue handles across starts and applies stop-at-end separately", () => {
  vi.stubGlobal("Audio", FakeAudio); const channels = new AudioChannels("JP", () => "test.wav");
  channels.handle({ kind: "play", channel: "se", name: "persistent", continueId: 1 });
  channels.handle({ kind: "play", channel: "se", name: "normal" });
  channels.handle({ kind: "stopAll", preserveContinue: true });
  expect(channels.isBusy("se", "persistent")).toBe(true); expect(channels.isBusy("se", "normal")).toBe(false);
  channels.handle({ kind: "stop", channel: "se", continueId: 1, atEnd: true }); expect(channels.isBusy("se")).toBe(true);
  channels.handle({ kind: "scriptEnd" }); expect(channels.isBusy("se")).toBe(false);
});
