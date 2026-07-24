import { describe, expect, it } from "vitest";
import {
  parseCommandParameters,
  parseInlineScriptText,
  parseScriptDocument,
} from "./scriptSyntax";

describe("script syntax", () => {
  it("tokenizes quoted and nested command parameters without losing source data", () => {
    expect(parseCommandParameters('futureCommand "two words" [nested value] tail')).toEqual([
      "futureCommand",
      "two words",
      "[nested value]",
      "tail",
    ]);

    const document = parseScriptDocument(
      '[futureCommand "two words" [nested value]]\n[futureCommand other]',
    );
    expect(document.nodes[0]).toMatchObject({
      type: "command",
      kind: "unknown",
      args: ["two words", "[nested value]"],
      raw: '[futureCommand "two words" [nested value]]',
      span: { startLine: 1, startColumn: 1 },
    });
    expect(document.diagnostics).toContainEqual(expect.objectContaining({
      code: "unknown_command",
      command: "futureCommand",
      count: 2,
    }));
  });

  it("builds nested ruby and gender inline nodes", () => {
    const parsed = parseInlineScriptText("[&[#先輩:せんぱい]:マスター]");
    expect(parsed.nodes).toMatchObject([
      {
        type: "gender",
        male: [{ type: "ruby", ruby: "せんぱい", text: [{ type: "text", value: "先輩" }] }],
        female: [{ type: "text", value: "マスター" }],
      },
    ]);
  });

  it("tracks choice label columns and diagnoses malformed structures", () => {
    const document = parseScriptDocument([
      "  ?1: First",
      "  ?1: Nested",
      "@旁白",
      "text[q]",
      "?!",
      "[broken",
    ].join("\n"), { region: "KR" });
    const choice = document.nodes[0];
    expect(choice.type).toBe("choice");
    if (choice.type === "choice") {
      expect(choice.options[0].label[0]).toMatchObject({
        type: "text",
        span: { startLine: 1, startColumn: 6 },
      });
    }
    expect(document.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["nested_choice", "unclosed_bracket"]),
    );
    expect(document.diagnostics).not.toContainEqual(expect.objectContaining({
      code: "empty_choice_option",
    }));
  });

  it("recognizes command families documented by the v1.2 format specification", () => {
    const documentedCommands = [
      "sceneSet Q 142200 1",
      "stretchin full 2.0 2.0",
      "charaRollAxis K y 180 0.1",
      "charaEffectEdgeBlur A ffffff ffffff 4 1",
      "charaBackEffect A bit_talk_lightning_01t",
      "charaCutout A 0.4",
      "soundStopAllFade 0.4",
      "seContinueVolume ad931 0.5 0.8 1",
      "cueSeContinueVolume m84916 0.5 0.8 1",
      "voiceStop NP_502300_1 0",
      "cameraFilter darkred",
      "effectPause bit_talk_rubble",
      "fowardEffectPause bit_talk_29",
      "distortionstart 3.5 0.5 0.5 0.4 0.4 10.0",
      "insertionAnimationStart ac_fude cut530",
      "branchQuestClear lblClear01 4000217",
      "branchRouteSelect select_answer_01 3000810 5000",
      "ifClear 60152100",
      "else",
      "endIf",
      "selectionUse masterFemale",
      "messageSpeedForcedNormal on",
      "backlogStart",
      "subCameraFilter #A through",
      "subRenderMoveEaseFSSideR #A 0,0 0.3 easeOutQuad",
      "masterSet L 1098348300 1098348310 1",
      "communicationChara 98003003 1 5 0 2",
      "fsmObjSet K ScriptUI/SelectPanel/select01 select01",
      "fadeMove white 1.5 0.9",
      "captureRelease",
      "tRaidShortName 80593 1",
    ];
    const document = parseScriptDocument(
      documentedCommands.map((command) => `[${command}]`).join("\n"),
    );

    expect(document.diagnostics).not.toContainEqual(expect.objectContaining({
      code: "unknown_command",
    }));
  });

  it("parses square-bracket spot speaker lists from the documented syntax", () => {
    const document = parseScriptDocument([
      "＠一同=spot[D,L,C,N,O,B,M,K]",
      "了解しました。[k]",
    ].join("\n"));
    const dialogue = document.nodes[0];

    expect(dialogue).toMatchObject({
      type: "dialogue",
      speaker: {
        rawName: "一同",
        spots: ["D", "L", "C", "N", "O", "B", "M", "K"],
      },
    });
  });
});
