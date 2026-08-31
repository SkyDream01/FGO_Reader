import { describe, expect, it } from "vitest";
import { parseScriptDocument } from "../lib/scriptSyntax";
import { compileScriptDocument } from "./compiler";
import { ScriptExecutor } from "./executor";

function createExecutor(source: string) {
  const document = parseScriptDocument(source, { region: "JP" });
  const program = compileScriptDocument(document, {
    scriptId: "test",
    masterName: "御主",
    masterGender: "male",
  });
  return { program, executor: new ScriptExecutor(program, {
    masterName: "御主",
    masterGender: "male",
    textSpeedMs: 28,
  }) };
}

describe("ScriptExecutor", () => {
  it("bursts bgm+scene+charaSet+fadein in one frame and suspends at [wait fade]", () => {
    const { executor } = createExecutor(`[bgm BGM_EVENT_2 0.1]
[scene 10110]
[charaSet A 98001000 0 マシュ]
[charaSet B 98003000 2 Dr.ロマン]
[charaFadein A 0.1 0]
[charaFadein B 0.1 2]
[fadein black 1]
[wait fade]

＠マシュ
来てくれたのね[k]
`);

    executor.start();
    const snapshot = executor.getSnapshot();

    // Same-frame burst (S-E8): everything launched before the wait suspends.
    expect(snapshot.bgm?.name).toBe("BGM_EVENT_2");
    expect(snapshot.background.id).toBe("10110");
    expect(snapshot.characters.map((character) => character.slot)).toEqual(["A", "B"]);
    expect(snapshot.fade.color).toBe("#000");
    expect(snapshot.phase).toBe("wait");

    // The fade tween completes after its duration; the wait releases by itself.
    executor.tick(1100);
    const afterFade = executor.getSnapshot();
    expect(afterFade.phase).toBe("message");
    expect(afterFade.message?.speaker).toBe("マシュ");
    expect(afterFade.message?.complete).toBe(false);
    expect(afterFade.fade.alpha).toBe(0);
  });

  it("steps the typewriter, completes on tap and advances on the next tap", () => {
    const { executor } = createExecutor("＠ロマン\nこんにちは[k]\n＠マシュ\nあ[k]");
    executor.start();
    expect(executor.getSnapshot().message?.total).toBe(5);

    executor.tick(28 * 5 + 200);
    expect(executor.getSnapshot().message?.complete).toBe(true);

    executor.tap(); // complete → release boundary
    const next = executor.getSnapshot();
    expect(next.message?.speaker).toBe("マシュ");
    expect(next.message?.total).toBe(1);
    expect(next.message?.complete).toBe(false);

    executor.tap(); // reveal all
    expect(executor.getSnapshot().message?.complete).toBe(true);
    executor.tap(); // advance → ended
    expect(executor.getSnapshot().phase).toBe("ended");
  });

  it("pushes completed messages into the backlog log", () => {
    const { executor } = createExecutor("＠ロマン\n一[k]\n＠マシュ\n二[k]");
    executor.start();
    executor.tick(5000);
    executor.tap();
    executor.tick(5000);
    const snapshot = executor.getSnapshot();
    expect(snapshot.log.map((entry) => entry.text)).toEqual(["一", "二"]);
    expect(snapshot.messageOrdinal).toBe(2);
  });

  it("runs jump/branch/flag control flow at runtime", () => {
    const { executor } = createExecutor(`[flag gate true]
[branch lblSkip gate true]
[bgm BGM_EVENT_1 1]
[label lblSkip]
[bgm BGM_EVENT_2 1]
＠テスト
終わり[k]
`);
    executor.start();
    // The conditional branch follows the true path: BGM_EVENT_1 is skipped.
    expect(executor.getSnapshot().bgm?.name).toBe("BGM_EVENT_2");
  });

  it("blocks at a choice and resumes through the selected body", () => {
    const { executor } = createExecutor(`＠選択
？1:一つ目
＠一つ目
一番[k]
？2:二つ目
＠二つ目
二番[k]
？！
＠後
共通[k]
`);
    executor.start();
    executor.tick(5000);
    executor.tap();
    executor.tick(5000);
    executor.tap();
    const atChoice = executor.getSnapshot();
    expect(atChoice.phase).toBe("choice");
    expect(atChoice.choice?.options.map((option) => option.label)).toEqual(["一つ目", "二つ目"]);

    executor.selectChoice(1);
    const after = executor.getSnapshot();
    expect(after.phase).toBe("message");
    expect(after.message?.speaker).toBe("二つ目");

    executor.tick(5000);
    executor.tap();
    expect(executor.getSnapshot().log.at(-1)?.text).toBe("共通");
    expect(executor.takeNewDecisions()).toEqual([
      { choiceId: atChoice.choice?.key, optionIndex: 1 },
    ]);
  });

  it("auto-consumes the decision trail while fast-forwarding to a stored position", () => {
    const source = `＠選択
？1:一つ目
＠一つ目
一番[k]
？2:二つ目
＠二つ目
二番[k]
？！
＠後
共通[k]
`;
    const { program, executor } = createExecutor(source);
    const choiceKey = program.choiceCatalog[0].key;

    // First run: player picks option 0 and stops at the final message.
    executor.start();
    executor.tick(5000);
    executor.tap();
    executor.tick(5000);
    executor.tap();
    executor.selectChoice(0);
    executor.tick(5000);
    executor.tap();
    executor.tick(5000);
    executor.tap();
    executor.tick(5000);
    executor.tap();
    const decisions = executor.takeNewDecisions();
    expect(decisions).toEqual([{ choiceId: choiceKey, optionIndex: 0 }]);

    // Second run (resume): the trail replays automatically.
    const resumed = new ScriptExecutor(program, {
      masterName: "御主",
      masterGender: "male",
      textSpeedMs: 28,
    });
    
    resumed.start({ choiceTrail: decisions, startIndex: program.instructions.length });
    const snapshot = resumed.getSnapshot();
    expect(snapshot.phase).toBe("message");
    expect(snapshot.log.at(-1)?.text).toBe("共通");
    // The log follows the executed path: the unchosen branch's message is
    // absent, exactly like the old frame-array backlog.
    expect(snapshot.log.map((entry) => entry.text)).toEqual(["", "一番", "共通"]);
  });

  it("enumerateUpcomingMessages follows the execution path past choices", () => {
    const { executor } = createExecutor(`＠前
導入[k]
＠選択
？1:一つ目
＠一つ目
一番[k]
？2:二つ目
＠二つ目
二番[k]
？！
＠後
共通[k]
`);
    executor.start();
    executor.tick(5000);
    executor.tap();
    executor.tick(5000);
    executor.tap();

    // No decision recorded: enumeration surfaces the choice itself and stops.
    expect(executor.enumerateUpcomingMessages(5)).toEqual([
      {
        key: expect.any(String),
        kind: "choice",
        speaker: "CHOICE",
        text: "",
        optionLabels: ["一つ目", "二つ目"],
      },
    ]);

    executor.selectChoice(1);
    // The selected message is already open (current), so only what follows is
    // "upcoming" — matching the old lookahead's slice(1) behavior.
    const upcoming = executor.enumerateUpcomingMessages(5);
    expect(upcoming.map((entry) => entry.text)).toEqual(["共通"]);
  });

  it("keeps message tokens with color markup for rendering", () => {
    const { executor } = createExecutor("＠[51d4ff]アナウンス[-]\n[51d4ff]青い文字[-][k]");
    executor.start();
    const snapshot = executor.getSnapshot();
    expect(snapshot.message?.speaker).toBe("アナウンス");
    // The colored span fills in as characters reveal.
    executor.tick(28 * 4 + 100);
    const revealed = executor.getSnapshot().message?.lines[0]?.spans ?? [];
    expect(revealed.some((span) => span.color === "#51d4ff" && span.text === "青い文字")).toBe(true);
  });
});
