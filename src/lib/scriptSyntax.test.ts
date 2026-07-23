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
});
