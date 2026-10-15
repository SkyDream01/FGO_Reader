# 简报: cluster `war`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## warBoardTalkScreen
- handler: `0x317cd60` case_entry: `0x317c734` verify: `0x317cd54` hash: `0x9537e6ad` min_token: None
- commands.json params: []
- command_params.json: handler=0x317cd60 optional_pd=[] shared_tail=0x3193f00
- context_apis: []
- params: []

## warCharaFadein
- handler: `0x317ac68` case_entry: `0x317ac38` verify: `0x317ac5c` hash: `0xa890df7d` min_token: None
- commands.json params: []
- command_params.json: handler=0x317ac68 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$IsMoveAlpha", "ScriptManager$$IsNormalPlaySpeed", "ScriptCharaData$$SetPosition"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽（A-Z/数字→槽位号）", "values": "A-Z / 数字", "confidence": "high", "evidence": ["0x317ac88 ConvertCharaIndex", 51883144], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "float 参数（淡入时间）", "values": "秒", "confidence": "medium", "evidence": ["0x317acf4 Single::Parse"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "int", "meaning": "int 参数", "values": "—", "confidence": "medium", "evidence": ["0x317ad18"], "sources": ["automation", "params-misc"]}, {"pd": 6, "type": "int", "meaning": "int 参数", "values": "—", "confidence": "medium", "evidence": ["0x317ad3c"], "sources": ["automation", "params-misc"]}, {"pd": 8, "type": "int", "meaning": "int 参数", "values": "—", "confidence": "medium", "evidence": ["0x317ad7c"], "sources": ["automation", "params-misc"]}, {"pd": 10, "type": "int", "meaning": "int 参数", "values": "—", "confidence": "medium", "evidence": ["0x317adac"], "sources": ["automation", "params-misc"]}, {"pd": 12, "type": "int", "meaning": "int 参数", "values": "—", "confidence": "medium", "evidence": ["0x317addc"], "sources": ["automation", "params-misc"]}]

## warEffectOff
- handler: `0x317fc60` case_entry: `0x317a490` verify: `0x317fc54` hash: `0xb8c3be19` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "get_Instance", "evidence": "0x317fc84"}]
- command_params.json: handler=0x317fc60 optional_pd=[] shared_tail=None
- context_apis: []
- params: [{"pd": 0, "type": "string", "meaning": "key", "values": "键名", "confidence": "high", "evidence": ["0x317fc84", "0x317fc94 StopEffectScript(key)"], "sources": ["automation", "params-misc"]}]

## warEffectPiece
- handler: `0x317fd14` case_entry: `0x317a7c0` verify: `0x317fd08` hash: `0xf9a697b6` min_token: 9
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "0x2230564", "evidence": "0x317fd40"}, {"index": 2, "name": null, "type": "unknown", "consumer": "0x2230564", "evidence": "0x317fd40"}, {"index": 4, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x317fd64"}, {"index": 6, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x317fd94"}, {"index": 8, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x317fdc4"}]
- command_params.json: handler=0x317fd14 optional_pd=[] shared_tail=None
- context_apis: []
- params: [{"pd": 0, "type": "string", "meaning": "key（特效键）", "values": "键名", "confidence": "high", "evidence": ["0x317fd40", "0x317fdfc PlayEffectPieceScript(key,effectName)"], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "string", "meaning": "特效名", "values": "资源名", "confidence": "high", "evidence": ["0x317fd40", "0x317fdfc"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "int", "meaning": "int 参数", "values": "整数", "confidence": "medium", "evidence": ["0x317fd64", "0x317fd64 Int32::Parse"], "sources": ["automation", "params-misc"]}, {"pd": 6, "type": "int", "meaning": "int 参数", "values": "整数", "confidence": "medium", "evidence": ["0x317fd94"], "sources": ["automation", "params-misc"]}, {"pd": 8, "type": "int", "meaning": "int 参数", "values": "整数", "confidence": "medium", "evidence": ["0x317fdc4"], "sources": ["automation", "params-misc"]}]

## warEffectPos
- handler: `0x3186664` case_entry: `0x317cbb8` verify: `0x318665c` hash: `0x9a791fe` min_token: 7
- commands.json params: [{"index": 0, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x3186688"}, {"index": 2, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x3186688"}, {"index": 4, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x3186688"}, {"index": 6, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x31866ac"}]
- command_params.json: handler=0x3186664 optional_pd=[] shared_tail=None
- context_apis: []
- params: [{"pd": 0, "type": "string", "meaning": "key", "values": "键名", "confidence": "high", "evidence": ["0x3186688", "0x31866dc PlayEffectPosScript"], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "string", "meaning": "特效名", "values": "资源名", "confidence": "high", "evidence": ["0x3186688", "0x31866dc"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "float", "meaning": "x（float）", "values": "坐标", "confidence": "medium", "evidence": ["0x3186688", "0x3186688 Single::Parse"], "sources": ["automation", "params-misc"]}, {"pd": 6, "type": "float", "meaning": "y（float）", "values": "坐标", "confidence": "medium", "evidence": ["0x31866ac"], "sources": ["automation", "params-misc"]}]

## warEffectSquare
- handler: `0x317f470` case_entry: `0x3179968` verify: `0x317f464` hash: `0xb0bcd6d3` min_token: 5
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x317f494"}, {"index": 2, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x317f494"}, {"index": 4, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x317f494"}]
- command_params.json: handler=0x317f470 optional_pd=[] shared_tail=None
- context_apis: []
- params: [{"pd": 0, "type": "string", "meaning": "key", "values": "键名", "confidence": "high", "evidence": ["0x317f494", "0x317f4c4 PlayEffectSquareScript"], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "string", "meaning": "特效名", "values": "资源名", "confidence": "high", "evidence": ["0x317f494", "0x317f4c4"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "int", "meaning": "int 参数", "values": "整数", "confidence": "medium", "evidence": ["0x317f494"], "sources": ["automation", "params-misc"]}]

## warEventScript
- handler: `0x317a1bc` case_entry: `0x317a18c` verify: `0x317a1b0` hash: `0x99feb508` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x317a1d8"}]
- command_params.json: handler=0x317a1bc optional_pd=[] shared_tail=None
- context_apis: ["ScriptSubLayerManager$$GetScriptSubLayer", "ScriptManager$$InitCameraRoll"]
- params: [{"pd": 0, "type": "int", "meaning": "事件脚本编号（int）", "values": "整数", "confidence": "high", "evidence": ["0x317a1d8", "0x317a1d8 Int32::Parse", 51880708], "sources": ["automation", "params-misc"]}]

## warMoveCameraPiece
- handler: `0x3187cec` case_entry: `0x317dd50` verify: `0x3187ce4` hash: `0xdb22bb53` min_token: 9
- commands.json params: [{"index": 2, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x3187d2c"}, {"index": 4, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x3187d50"}, {"index": 6, "name": null, "type": "unknown", "consumer": "0x2230564", "evidence": "0x3187d80"}, {"index": 8, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x3187da4"}, {"index": 10, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x3187dd4"}, {"index": 12, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x3187e04"}]
- command_params.json: handler=0x3187cec optional_pd=[1, 2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$IsMoveAlpha", "ScriptManager$$EndFlash", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$ResumeBackEffect"]
- params: [{"pd": 0, "type": "int", "meaning": "棋子编号（int）", "values": "整数", "confidence": "high", "evidence": ["0x3187d08 Int32::Parse", 51936928], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "float 参数", "values": "—", "confidence": "medium", "evidence": ["0x3187d2c", 51937368], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "float", "meaning": "float 参数", "values": "—", "confidence": "medium", "evidence": ["0x3187d50"], "sources": ["automation", "params-misc"]}, {"pd": 6, "type": "unknown", "consumer": "0x2230564", "evidence": ["0x3187d80"], "meaning": null, "conv": [], "api_hint": null, "sources": ["automation"], "confidence": "?"}, {"pd": 8, "type": "int", "meaning": "int 参数", "values": "—", "confidence": "medium", "evidence": ["0x3187da4"], "sources": ["automation", "params-misc"]}, {"pd": 10, "type": "int", "meaning": "int 参数", "values": "—", "confidence": "medium", "evidence": ["0x3187dd4"], "sources": ["automation", "params-misc"]}, {"pd": 12, "type": "int", "meaning": "int 参数", "values": "—", "confidence": "medium", "evidence": ["0x3187e04"], "sources": ["automation", "params-misc"]}]

## warMoveCameraPos
- handler: `0x317df90` case_entry: `0x317df60` verify: `0x317df84` hash: `0xf73ba0e3` min_token: 7
- commands.json params: [{"index": 2, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317dfd0"}, {"index": 4, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317dff4"}, {"index": 6, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317e024"}, {"index": 8, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317e024"}, {"index": 10, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317e048"}]
- command_params.json: handler=0x317df90 optional_pd=[] shared_tail=None
- context_apis: []
- params: [{"pd": 0, "type": "int", "meaning": "int 参数", "values": "—", "confidence": "medium", "evidence": ["0x317dfac Int32::Parse"], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "float 参数", "values": "—", "confidence": "medium", "evidence": ["0x317dfd0"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "float", "meaning": "float 参数", "values": "—", "confidence": "medium", "evidence": ["0x317dff4"], "sources": ["automation", "params-misc"]}, {"pd": 6, "type": "string", "meaning": "easeType（缓动类型）", "values": "缓动名", "confidence": "medium", "evidence": ["0x317e024", "0x317e080 MoveCameraPosScript(easeType)"], "sources": ["automation", "params-misc"]}, {"pd": 8, "type": "float", "meaning": "float 参数", "values": "—", "confidence": "medium", "evidence": ["0x317e024"], "sources": ["automation", "params-misc"]}, {"pd": 10, "type": "float", "meaning": "float 参数", "values": "—", "confidence": "medium", "evidence": ["0x317e048"], "sources": ["automation", "params-misc"]}]

## warMoveCameraSquare
- handler: `0x3183030` case_entry: `0x317e144` verify: `0x3183028` hash: `0x525668fc` min_token: 9
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x318304c"}, {"index": 2, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x3183070"}, {"index": 4, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x3183094"}, {"index": 6, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x31830c4"}, {"index": 8, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x31830c4"}]
- command_params.json: handler=0x3183030 optional_pd=[] shared_tail=None
- context_apis: []
- params: [{"pd": 0, "type": "int", "meaning": "int 参数", "values": "—", "confidence": "medium", "evidence": ["0x318304c", "0x318304c Int32::Parse"], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "float 参数", "values": "—", "confidence": "medium", "evidence": ["0x3183070"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "float", "meaning": "float 参数", "values": "—", "confidence": "medium", "evidence": ["0x3183094"], "sources": ["automation", "params-misc"]}, {"pd": 6, "type": "string", "meaning": "easeType", "values": "缓动名", "confidence": "medium", "evidence": ["0x31830c4", "0x31830fc MoveCameraSquareScript(easeType)"], "sources": ["automation", "params-misc"]}, {"pd": 8, "type": "int", "meaning": "int 参数", "values": "—", "confidence": "medium", "evidence": ["0x31830c4"], "sources": ["automation", "params-misc"]}]
