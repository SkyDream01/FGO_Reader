import type { ScriptAsset } from "./instruction";

export function backgroundId(name: string): string {
  return name.replace(/^(?:Back\/)?back/, "");
}

export function resourcePath(kind: ScriptAsset["kind"], name: string): string {
  switch (kind) {
    case "background": return `Back/back${backgroundId(name).padStart(5, "0")}`;
    case "figure": return `CharaFigure/${name}`;
    case "equip": return `CharaGraph/${name}`;
    case "image": return `Image/${name.replace(/^Image\//, "")}`;
    case "bgm": return `Audio/Bgm/${name}.cpk.bytes`;
    case "audio": return `Se/${name.replace(/^Se\//, "")}`;
    case "effect": return `Effect/Talk/${name.replace(/^(?:Effect\/)?Talk\//, "")}`;
    case "movie": return `Movie/${name.replace(/\.(?:usm|mp4|webm)$/, "")}.usm`;
    case "wipe": return `Wipe/${name}`;
  }
}

export function commandAssets(tag: string, params: readonly string[], gender: "male" | "female"): ScriptAsset[] {
  let name: string | undefined, kind: ScriptAsset["kind"] | undefined;
  const master = tag.startsWith("master");
  const base = master ? tag.slice(6).replace(/^./, (letter) => letter.toLowerCase()) : tag;
  const resourceIndex = master ? (gender === "female" ? 2 : 1) : 1;
  if (tag === "scene" || tag === "bScene" || tag === "masterScene") {
    name = params[master && gender === "female" ? 1 : 0]; kind = "background";
  } else if (base === "sceneSet") {
    name = params[1]; kind = "background";
  } else if (tag === "equipSet" || tag === "equipChange") {
    name = params[1]; kind = "equip";
  } else if (/^(?:chara|figure|equip)(?:Set|Change|CrossFade)$/.test(base) || tag === "masterSet" || tag === "masterChange") {
    name = params[resourceIndex]; kind = "figure";
  } else if (/^(?:image|verticalImage|horizontalImage)(?:Set|Change)$/.test(base)) {
    name = params[resourceIndex]; kind = "image";
  } else if (tag === "bgm" || tag === "subBgm") {
    name = params[0]; kind = "bgm";
  } else if (["se", "seLoop", "seContinue", "voice", "tVoice", "tVoiceUser", "jingle"].includes(tag)) {
    name = params[0]; kind = "audio";
  } else if (["cueSe", "cueSeContinue", "cueVoice"].includes(tag)) {
    name = params[1] ? `Se/${params[0]}/${params[1]}` : undefined; kind = "audio";
  } else if (["charaEffect", "charaBackEffect", "charaSpecialEffect", "charaEffectPause", "charaBackEffectPause", "charaSpecialEffectPause"].includes(tag)) {
    name = params[1]; kind = "effect";
  } else if (tag === "communicationChara" || tag === "communicationCharaLoop") {
    name = params[0]; kind = "figure";
  } else if (["effect", "backEffect", "fowardEffect", "specialEffect", "effectmessage"].includes(tag)) {
    name = params[0]; kind = "effect";
  } else if (tag === "pictureFrame" || tag === "pictureFrameTop") {
    name = params[0]; kind = "image";
  } else if (tag === "subCameraFilter") {
    const index = params[0]?.startsWith("#") ? 1 : 0;
    if (params[index] === "maskEdge") { name = params[index + 1]; kind = "image"; }
  } else if (tag === "talkNameBack") {
    name = params[0]; kind = "image";
  } else if (tag === "spriteMaskSet") {
    name = params[0] ? `mask_${params[0]}` : undefined; kind = "image";
  } else if (tag === "movie" || tag === "criMovie") {
    name = params[0]; kind = "movie";
  } else if (/^wipe(?:in|out|Filter)(?:Ex)?$/.test(tag)) {
    name = params[0]; kind = "wipe";
  }
  if (!name || !kind) return [];
  name = name.replace(/^"(.*)"$/, "$1");
  if (kind === "background") name = backgroundId(name);
  return [{ kind, name, path: resourcePath(kind, name), ...(["talkNameBack", "spriteMaskSet"].includes(tag) ? { optional: true } : {}) }];
}

/** Form-specific figure, base figure, then the native default figure. */
export function figureResourceCandidates(name: string): string[] {
  const base = name.replace(/^Form\/[^/]+\//, "");
  return [...new Set([name, base, "1000000"])];
}
