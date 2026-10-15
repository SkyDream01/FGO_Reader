import { expect, it } from "vitest";
import { cleanScriptText, compileFgoScript } from "./scriptParser";

it("uses the same native markup parser for previews and compiled messages", () => {
  const source = "你好[r][#前辈:せんぱい]，[&君:ちゃん]，[%1]";
  const preview = cleanScriptText(source, "藤丸", "female");
  expect(preview).toBe("你好\n前辈，ちゃん，藤丸");
  expect(compileFgoScript(`＠玛修\n${source}\n[k]`, "test", { masterName: "藤丸", masterGender: "female" }).messageCatalog[0].text).toBe(preview);
});
