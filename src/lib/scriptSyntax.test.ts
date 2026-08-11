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

  it("resolves v1.3 label-based choice routes and preserves saveMaterial metadata", () => {
    const document = parseScriptDocument([
      "[input selectBranch]",
      "[label selectBranch]",
      "？1,1000,saveMaterial：分支 A",
      "[branch lblBranchA]",
      "？2：分支 B",
      "[branch lblBranchB]",
      "？！",
      "[label lblBranchA]",
      "＠A：A",
      "分支 A 内容。[k]",
      "[branch lblEnd]",
      "[label lblBranchB]",
      "＠B：B",
      "分支 B 内容。[k]",
      "[label lblEnd]",
      "＠N：旁白",
      "共通后续。[k]",
    ].join("\n"));

    const choice = document.nodes.find((node) => node.type === "choice");
    expect(choice).toMatchObject({
      type: "choice",
      options: [
        {
          routeInfo: { route: 1000, saveMaterial: true, routeType: "none" },
          body: [{ type: "dialogue" }],
        },
        { body: [{ type: "dialogue" }] },
      ],
    });
    expect(document.nodes.at(-1)).toMatchObject({
      type: "dialogue",
      speaker: { rawName: "旁白" },
    });
    expect(document.diagnostics).not.toContainEqual(expect.objectContaining({
      code: "unresolved_choice_routes",
    }));
  });

  it("does not treat // lines as comments and recognizes v1.3 wait targets", () => {
    const document = parseScriptDocument([
      "// 这是一行文本，不是注释",
      "[tVoice ChrVoice_7100100 0_T010 0.4]",
      "[fastPlayDraw A]",
      "[fsmObjFinished K]",
    ].join("\n"));

    expect(document.diagnostics).toContainEqual(expect.objectContaining({ code: "orphan_text" }));
    expect(document.diagnostics).not.toContainEqual(expect.objectContaining({
      code: "unknown_command",
    }));
  });

  it("accepts an optional documented header in any of the first five lines", () => {
    const document = parseScriptDocument([
      "",
      "",
      "",
      "",
      "＄93-00-03-01-1-0",
      "＠N：旁白",
      "头部后的台词。[k]",
    ].join("\n"));

    expect(document.nodes).toEqual([
      expect.objectContaining({
        type: "dialogue",
        speaker: expect.objectContaining({ rawName: "旁白" }),
      }),
    ]);
  });
});
