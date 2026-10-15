# 简报: cluster `effects`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## backEffect
- handler: `0x317c3c0` case_entry: `0x317c390` verify: `0x317c3b4` hash: `0x4a6c6c2f` min_token: 5
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x317c3e0"}]
- command_params.json: handler=0x317c3c0 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$GetEffectParameter", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x317c3e0", 51889120], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x317c45c"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "`','`(坐标形式)", "values": null, "confidence": "high", "evidence": ["0x317c490"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 `' '`(守卫 pd[6]=翻转/朝向)", "values": null, "confidence": "medium", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "翻转/朝向(ConvertEffectFlipKind)", "values": null, "confidence": "medium", "evidence": ["0x318f054"], "sources": ["automation", "params-visual"]}]

## backEffectDestroy
- handler: `0x3184ad0` case_entry: `0x317b6e0` verify: `0x3184ac8` hash: `0xa7f3d9f` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3184af0"}]
- command_params.json: handler=0x3184ad0 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "CommonEffectManager$$Stop"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x3184298", "0x3184af0", 51923696], "sources": ["automation", "params-visual"]}]

## backEffectPause
- handler: `0x317c3c0` case_entry: `0x317956c` verify: `0x317c3b4` hash: `0x10c8602f` min_token: 5
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x317c3e0"}]
- command_params.json: handler=0x317c3c0 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$GetEffectParameter", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x317c3e0", 51889120], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x317c45c"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "`','`(坐标形式)", "values": null, "confidence": "high", "evidence": ["0x317c490"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 `' '`(守卫 pd[6]=翻转/朝向)", "values": null, "confidence": "medium", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "翻转/朝向(ConvertEffectFlipKind)", "values": null, "confidence": "medium", "evidence": ["0x318f054"], "sources": ["automation", "params-visual"]}]

## backEffectStart
- handler: `0x3182470` case_entry: `0x317d694` verify: `0x3182468` hash: `0xfa9a46a5` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3182490"}]
- command_params.json: handler=0x3182470 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed", "CommonEffectManager$$Resume"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x3182490", "0x3184298", 51913872], "sources": ["automation", "params-visual"]}]

## backEffectStop
- handler: `0x317ebac` case_entry: `0x3179070` verify: `0x317eba0` hash: `0x1db4e77` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x317ebcc"}]
- command_params.json: handler=0x317ebac optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x317ebcc", "0x3184298", 51899340], "sources": ["automation", "params-visual"]}]

## charaBackEffect
- handler: `0x3181664` case_entry: `0x317c4c8` verify: `0x318165c` hash: `0xc01f6afa` min_token: 3
- commands.json params: []
- command_params.json: handler=0x3181664 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x31816b4", 51910324], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318168c"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x31816f8", 51910392], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318168c"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 `,`(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318168c"], "sources": ["automation", "params-visual"]}, {"pd": 7, "type": "?", "meaning": "未知", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "string", "meaning": "翻转/朝向(H/V/F/其他)", "values": null, "confidence": "medium", "evidence": ["0x3192464"], "sources": ["automation", "params-visual"]}]

## charaBackEffectDestroy
- handler: `0x317b2e0` case_entry: `0x317b2b0` verify: `0x317b2d4` hash: `0xdb14b6f4` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x317b300"}]
- command_params.json: handler=0x317b2e0 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$StopBackEffect"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317b300", "0x31880b0", 51884800], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317b34c"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51884920], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317b34c"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "颜色(名称或 #RRGGBB)", "values": null, "confidence": "medium", "evidence": ["0x318d2b8"], "sources": ["automation", "params-visual"]}]

## charaBackEffectPause
- handler: `0x3181664` case_entry: `0x317e154` verify: `0x318165c` hash: `0x5272f94c` min_token: 3
- commands.json params: []
- command_params.json: handler=0x3181664 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x31816b4", 51910324], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318168c"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x31816f8", 51910392], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318168c"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 `,`(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318168c"], "sources": ["automation", "params-visual"]}, {"pd": 7, "type": "?", "meaning": "未知", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "string", "meaning": "翻转/朝向(H/V/F/其他)", "values": null, "confidence": "medium", "evidence": ["0x3192464"], "sources": ["automation", "params-visual"]}]

## charaBackEffectStart
- handler: `0x3187fb4` case_entry: `0x317df40` verify: `0x3187fac` hash: `0xf6a3c7e2` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "IsFastPlaySpeed", "evidence": "0x3188000"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x3187fd4"}, {"index": 2, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3188058"}]
- command_params.json: handler=0x3187fb4 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$ResumeBackEffect"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3188000", "0x31880b0", 51937236], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3188030"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": ["0x3188058", 51937368], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3188030"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "颜色(名称或 #RRGGBB)", "values": null, "confidence": "medium", "evidence": ["0x318d2b8"], "sources": ["automation", "params-visual"]}]

## charaBackEffectStop
- handler: `0x317e538` case_entry: `0x317e508` verify: `0x317e52c` hash: `0x6fe20be2` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "bool", "consumer": "ModifyPlaySpeed", "evidence": "0x317e588"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x317e558"}]
- command_params.json: handler=0x317e538 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ModifyPlaySpeed", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$StopBackEffect"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317e588", "0x31880b0", 51897688], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317e5c4"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51897840], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}]

## charaEffect
- handler: `0x3187a5c` case_entry: `0x317c160` verify: `0x3187a54` hash: `0xfb0c36fd` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x3187aa8"}, {"index": 2, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3187aec"}]
- command_params.json: handler=0x3187a5c optional_pd=[2, 4, 6] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3187aa8", 51935912], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187a84"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "特效名(Talk/<name>);亦作滤镜名(SetFilterCharaData)", "values": null, "confidence": "high", "evidence": ["0x3187aec", "0x3187aec / 0x31925e0", 51935980], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187a84"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "颜色名(black/white/#RRGGBB 等)", "values": null, "confidence": "medium", "evidence": ["0x318d2b8"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 `,`(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187a84"], "sources": ["automation", "params-visual"]}, {"pd": 7, "type": "?", "meaning": "未知", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "string", "meaning": "翻转/朝向(ConvertEffectFlipKind)", "values": null, "confidence": "medium", "evidence": ["0x319258c"], "sources": ["automation", "params-visual"]}]

## charaEffectDestroy
- handler: `0x317f398` case_entry: `0x3179828` verify: `0x317f38c` hash: `0x39ab340d` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x317f3b8"}]
- command_params.json: handler=0x317f398 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$StopEffect"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317f3b8", "0x31880b0", 51901368], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317f404"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51901488], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}]

## charaEffectEdgeBlur
- handler: `0x3188390` case_entry: `0x317e178` verify: `0x3188388` hash: `0xd115434d` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x31883b0"}]
- command_params.json: handler=0x3188390 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x31883b0", 51938224], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318a4d0"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "颜色名(black/white/#RRGGBB 等)", "values": null, "confidence": "medium", "evidence": ["0x318a464"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318a4d0"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "颜色名(black/white/#RRGGBB 等)", "values": null, "confidence": "medium", "evidence": ["0x318d2b8"], "sources": ["automation", "params-visual"]}]

## charaEffectEdgeBlurDestroy
- handler: `0x31865b8` case_entry: `0x317ca88` verify: `0x31865b0` hash: `0x7489677d` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "StopEffect", "evidence": "0x3186608"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x31865d8"}]
- command_params.json: handler=0x31865b8 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$StopEffect"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x31865d8", "0x3186608", 51930584], "sources": ["automation", "params-visual"]}]

## charaEffectEdgeBlurPause
- handler: `0x3188390` case_entry: `0x317c64c` verify: `0x3188388` hash: `0xe7ddf525` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x31883b0"}]
- command_params.json: handler=0x3188390 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x31883b0", 51938224], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318a4d0"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "颜色名(black/white/#RRGGBB 等)", "values": null, "confidence": "medium", "evidence": ["0x318a464"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318a4d0"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "颜色名(black/white/#RRGGBB 等)", "values": null, "confidence": "medium", "evidence": ["0x318d2b8"], "sources": ["automation", "params-visual"]}]

## charaEffectEdgeBlurStart
- handler: `0x317b730` case_entry: `0x317b700` verify: `0x317b724` hash: `0xb129a77` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "IsFastPlaySpeed", "evidence": "0x317b77c"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x317b750"}]
- command_params.json: handler=0x317b730 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317b750", "0x317b77c", 51885904], "sources": ["automation", "params-visual"]}]

## charaEffectEdgeBlurStop
- handler: `0x317eabc` case_entry: `0x317ea8c` verify: `0x317eab0` hash: `0x82c040dd` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "bool", "consumer": "ModifyPlaySpeed", "evidence": "0x317eb0c"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x317eadc"}]
- command_params.json: handler=0x317eabc optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ModifyPlaySpeed", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317eadc", "0x317eb0c", 51899100], "sources": ["automation", "params-visual"]}]

## charaEffectPause
- handler: `0x3187a5c` case_entry: `0x317db1c` verify: `0x3187a54` hash: `0xea99cd15` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x3187aa8"}, {"index": 2, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3187aec"}]
- command_params.json: handler=0x3187a5c optional_pd=[2, 4, 6] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3187aa8", 51935912], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187a84"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "特效名(Talk/<name>);亦作滤镜名(SetFilterCharaData)", "values": null, "confidence": "high", "evidence": ["0x3187aec", "0x3187aec / 0x31925e0", 51935980], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187a84"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "颜色名(black/white/#RRGGBB 等)", "values": null, "confidence": "medium", "evidence": ["0x318d2b8"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 `,`(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187a84"], "sources": ["automation", "params-visual"]}, {"pd": 7, "type": "?", "meaning": "未知", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "string", "meaning": "翻转/朝向(ConvertEffectFlipKind)", "values": null, "confidence": "medium", "evidence": ["0x319258c"], "sources": ["automation", "params-visual"]}]

## charaEffectStart
- handler: `0x3188090` case_entry: `0x317e088` verify: `0x3188088` hash: `0xb718787` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "IsFastPlaySpeed", "evidence": "0x31880dc"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x31880b0"}, {"index": 2, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3188134"}]
- command_params.json: handler=0x3188090 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$ResumeEffect"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x31880b0", "0x31880dc", 51937456], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318810c"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": ["0x3188134", 51937588], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}]

## charaEffectStop
- handler: `0x317a4d0` case_entry: `0x317a4a0` verify: `0x317a4c4` hash: `0xb8f2092d` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "bool", "consumer": "ModifyPlaySpeed", "evidence": "0x317a520"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x317a4f0"}]
- command_params.json: handler=0x317a4d0 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ModifyPlaySpeed", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$StopEffect"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317a520", "0x31880b0", 51881200], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317a55c"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51881352], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317a55c"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "颜色(名称或 #RRGGBB)", "values": null, "confidence": "medium", "evidence": ["0x318d2b8"], "sources": ["automation", "params-visual"]}]

## charaSpecialEffect
- handler: `0x3184b84` case_entry: `0x317b8b0` verify: `0x3184b7c` hash: `0x4f3fe4c2` min_token: 3
- commands.json params: []
- command_params.json: handler=0x3184b84 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptManager$$ScriptCommandExecute", "ScriptManager$$IsContinueSilhouette", "ScriptManager$$GetCharaSpecialEffectSubParam"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3184bd4", 51923924], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x3184bac"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "特效名(ConvertNameString)", "values": null, "confidence": "high", "evidence": ["0x3184c1c", 51923996], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符/占位(见 0x318d444 比较)", "values": null, "confidence": "medium", "evidence": ["0x318d444"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "`','`=坐标形式(x,y)", "values": null, "confidence": "medium", "evidence": ["0x318d474"], "sources": ["automation", "params-visual"]}, {"pd": 7, "type": "separator", "meaning": "分隔符", "values": null, "confidence": "medium", "evidence": ["0x318d51c"], "sources": ["automation", "params-visual"]}, {"pd": 9, "type": "separator", "meaning": "分隔符(守卫 pd[10]=颜色)", "values": null, "confidence": "medium", "evidence": ["0x318d568"], "sources": ["automation", "params-visual"]}, {"pd": 10, "type": "string", "meaning": "颜色名(black/white/#RRGGBB 等)", "values": null, "confidence": "medium", "evidence": ["0x318d590"], "sources": ["automation", "params-visual"]}, {"pd": 11, "type": "separator", "meaning": "分隔符", "values": null, "confidence": "medium", "evidence": ["0x318d5c8"], "sources": ["automation", "params-visual"]}]

## charaSpecialEffectPause
- handler: `0x3184b84` case_entry: `0x3179ac8` verify: `0x3184b7c` hash: `0x8b071724` min_token: 3
- commands.json params: []
- command_params.json: handler=0x3184b84 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptManager$$ScriptCommandExecute", "ScriptManager$$IsContinueSilhouette", "ScriptManager$$GetCharaSpecialEffectSubParam"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3184bd4", 51923924], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x3184bac"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "特效名(ConvertNameString)", "values": null, "confidence": "high", "evidence": ["0x3184c1c", 51923996], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符/占位(见 0x318d444 比较)", "values": null, "confidence": "medium", "evidence": ["0x318d444"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "`','`=坐标形式(x,y)", "values": null, "confidence": "medium", "evidence": ["0x318d474"], "sources": ["automation", "params-visual"]}, {"pd": 7, "type": "separator", "meaning": "分隔符", "values": null, "confidence": "medium", "evidence": ["0x318d51c"], "sources": ["automation", "params-visual"]}, {"pd": 9, "type": "separator", "meaning": "分隔符(守卫 pd[10]=颜色)", "values": null, "confidence": "medium", "evidence": ["0x318d568"], "sources": ["automation", "params-visual"]}, {"pd": 10, "type": "string", "meaning": "颜色名(black/white/#RRGGBB 等)", "values": null, "confidence": "medium", "evidence": ["0x318d590"], "sources": ["automation", "params-visual"]}, {"pd": 11, "type": "separator", "meaning": "分隔符", "values": null, "confidence": "medium", "evidence": ["0x318d5c8"], "sources": ["automation", "params-visual"]}]

## charaSpecialEffectStart
- handler: `0x3186754` case_entry: `0x317cd10` verify: `0x318674c` hash: `0xccfb6cfa` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x3186774"}, {"index": 2, "name": null, "type": "string", "consumer": "ConvertNameString", "evidence": "0x31867e8"}]
- command_params.json: handler=0x3186754 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptManager$$IsFastPlaySpeed", "ScriptCharaData$$ResumeSpecialEffect"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3186774", "0x31880b0", 51930996], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x31867c0"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "consumer": "ConvertNameString", "evidence": ["0x31867e8", 51931112], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x31867c0"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "颜色(名称或 #RRGGBB)", "values": null, "confidence": "medium", "evidence": ["0x318d2b8"], "sources": ["automation", "params-visual"]}]

## charaSpecialEffectStop
- handler: `0x318198c` case_entry: `0x317c698` verify: `0x3181984` hash: `0x119470da` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x31819ac"}]
- command_params.json: handler=0x318198c optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptCharaData$$StopSpecialEffect"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x31819ac", "0x31880b0", 51911084], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x31819f8"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51911204], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}]

## effect
- handler: `0x3180b70` case_entry: `0x317bb14` verify: `0x3180b64` hash: `0x6e6e8d54` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3180b90"}]
- command_params.json: handler=0x3180b70 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$GetEffectParameter", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x3180b90", 51907472], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x3180c94"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "`','`(坐标形式)", "values": null, "confidence": "high", "evidence": ["0x3180cc8"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 `' '`(守卫 pd[6]=翻转/朝向)", "values": null, "confidence": "medium", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "翻转/朝向 H/V/F(ConvertEffectFlipKind)", "values": null, "confidence": "high", "evidence": ["0x319002c"], "sources": ["automation", "params-visual"]}, {"pd": 10, "type": "string", "meaning": "画框图片(ConvertPictureFrameImageName)", "values": null, "confidence": "medium", "evidence": ["0x3190240"], "sources": ["automation", "params-visual"]}]

## effectDestroy
- handler: `0x3184278` case_entry: `0x317a7b0` verify: `0x3184270` hash: `0xf8310406` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3184298"}]
- command_params.json: handler=0x3184278 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "CommonEffectManager$$Stop"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x3184298", 51921560], "sources": ["automation", "params-visual"]}]

## effectForceStop
- handler: `0x3184508` case_entry: `0x317aa80` verify: `0x3184500` hash: `0xc0c274bf` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3184528"}]
- command_params.json: handler=0x3184508 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed", "CommonEffectManager$$ForceStop"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x3184298", "0x3184528", 51922216], "sources": ["automation", "params-visual"]}]

## effectPause
- handler: `0x3180b70` case_entry: `0x317dea8` verify: `0x3180b64` hash: `0xb7e2027e` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3180b90"}]
- command_params.json: handler=0x3180b70 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$GetEffectParameter", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x3180b90", 51907472], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x3180c94"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "`','`(坐标形式)", "values": null, "confidence": "high", "evidence": ["0x3180cc8"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 `' '`(守卫 pd[6]=翻转/朝向)", "values": null, "confidence": "medium", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "翻转/朝向 H/V/F(ConvertEffectFlipKind)", "values": null, "confidence": "high", "evidence": ["0x319002c"], "sources": ["automation", "params-visual"]}, {"pd": 10, "type": "string", "meaning": "画框图片(ConvertPictureFrameImageName)", "values": null, "confidence": "medium", "evidence": ["0x3190240"], "sources": ["automation", "params-visual"]}]

## effectStart
- handler: `0x317cca8` case_entry: `0x317cc78` verify: `0x317cc9c` hash: `0x8e961ad8` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x317ccc8"}]
- command_params.json: handler=0x317cca8 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x317ccc8", "0x3184298", 51891400], "sources": ["automation", "params-visual"]}]

## effectStop
- handler: `0x31821f8` case_entry: `0x317d4a8` verify: `0x31821f0` hash: `0x45bba27c` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3182218"}]
- command_params.json: handler=0x31821f8 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed", "CommonEffectManager$$Stop"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x3182218", "0x3184298", 51913240], "sources": ["automation", "params-visual"]}]

## effectmessageDestroy
- handler: `0x3181ce4` case_entry: `0x317ca98` verify: `0x3181cdc` hash: `0x7662206b` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x3181d04"}]
- command_params.json: handler=0x3181ce4 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名", "values": "资源名", "confidence": "high", "evidence": ["0x31814e4", "0x3181d04", "0x3181d04 ConvertTalkEffectName", 51911940], "sources": ["automation", "params-misc", "params-visual"]}]

## effectmessageStop
- handler: `0x31814c4` case_entry: `0x317c1ac` verify: `0x31814bc` hash: `0x2c09cdb` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x31814e4"}]
- command_params.json: handler=0x31814c4 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名（Talk/<name>）", "values": "资源名", "confidence": "high", "evidence": ["0x31814e4", "0x31814e4 ConvertTalkEffectName", 51909860], "sources": ["automation", "params-misc", "params-visual"]}]

## fowardEffect
- handler: `0x318087c` case_entry: `0x317bad8` verify: `0x3180870` hash: `0xae20810d` min_token: 5
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x318089c"}, {"index": 2, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x318f6f8"}]
- command_params.json: handler=0x318087c optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$GetEffectParameter", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x318089c", 51906716], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x3180928"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "int", "consumer": "Parse", "evidence": ["0x318f6f8"], "meaning": null, "conv": [], "api_hint": null, "sources": ["automation"], "confidence": "?"}, {"pd": 3, "type": "separator", "meaning": "`','`(坐标形式)", "values": null, "confidence": "high", "evidence": ["0x318095c"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 `' '`(守卫 pd[6]=翻转/朝向)", "values": null, "confidence": "medium", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "翻转/朝向(ConvertEffectFlipKind)", "values": null, "confidence": "medium", "evidence": ["0x318f4e8"], "sources": ["automation", "params-visual"]}, {"pd": 27, "type": "string", "meaning": "附加参数(超出常规布局,含义未证实)", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}]

## fowardEffectDestroy
- handler: `0x317db6c` case_entry: `0x317db3c` verify: `0x317db60` hash: `0xeb4e703d` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x317db8c"}]
- command_params.json: handler=0x317db6c optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x317db8c", "0x3184298", 51895180], "sources": ["automation", "params-visual"]}]

## fowardEffectPause
- handler: `0x318087c` case_entry: `0x317b574` verify: `0x3180870` hash: `0x79355ce5` min_token: 5
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x318089c"}, {"index": 2, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x318f6f8"}]
- command_params.json: handler=0x318087c optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$GetEffectParameter", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x318089c", 51906716], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x3180928"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "int", "consumer": "Parse", "evidence": ["0x318f6f8"], "meaning": null, "conv": [], "api_hint": null, "sources": ["automation"], "confidence": "?"}, {"pd": 3, "type": "separator", "meaning": "`','`(坐标形式)", "values": null, "confidence": "high", "evidence": ["0x318095c"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 `' '`(守卫 pd[6]=翻转/朝向)", "values": null, "confidence": "medium", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "翻转/朝向(ConvertEffectFlipKind)", "values": null, "confidence": "medium", "evidence": ["0x318f4e8"], "sources": ["automation", "params-visual"]}, {"pd": 27, "type": "string", "meaning": "附加参数(超出常规布局,含义未证实)", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}]

## fowardEffectStart
- handler: `0x318140c` case_entry: `0x317c110` verify: `0x3181404` hash: `0x80a47737` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x318142c"}]
- command_params.json: handler=0x318140c optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x318142c", "0x3184298", 51909676], "sources": ["automation", "params-visual"]}]

## fowardEffectStop
- handler: `0x318496c` case_entry: `0x317b448` verify: `0x3184964` hash: `0xb5b3e89d` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertTalkEffectName", "evidence": "0x318498c"}]
- command_params.json: handler=0x318496c optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed", "CommonEffectManager$$Stop"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(Talk/<name>)", "values": null, "confidence": "high", "evidence": ["0x3184298", "0x318498c", 51923340], "sources": ["automation", "params-visual"]}]

## specialEffect
- handler: `0x3187604` case_entry: `0x317d23c` verify: `0x31875fc` hash: `0x9b439b01` min_token: 9
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertNameString", "evidence": "0x3187624"}, {"index": 2, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x31876bc"}, {"index": 4, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x31876e0"}, {"index": 6, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x3187764"}]
- command_params.json: handler=0x3187604 optional_pd=[2, 4, 6, 8, 10] shared_tail=None
- context_apis: ["ScriptManager$$ConvertNameString", "ScriptManager$$ScriptCommandExecute", "ScriptPosition$$GetPosition", "ScriptManager$$ConvertColor"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(ConvertNameString→CreateMainEffect)", "values": null, "confidence": "high", "evidence": ["0x3187624", 51934756], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187668"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "int", "meaning": "X 坐标(位置)", "values": null, "confidence": "low", "evidence": ["0x31876bc"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 `,`(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187668"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "int", "meaning": "Y 坐标(CreateMainEffect.pos)", "values": null, "confidence": "high", "evidence": ["0x31876e0", "0x3188e54"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187668"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "朝向/翻转(ConvertEffectFlipKind)或时长(time)", "values": null, "confidence": "high", "evidence": ["0x3187764", "0x318f4e8"], "sources": ["automation", "params-visual"]}, {"pd": 7, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187668"], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "string", "meaning": "颜色名(black/white/#RRGGBB 等)", "values": null, "confidence": "high", "evidence": ["0x31877b8", 51935160], "sources": ["automation", "params-visual"]}, {"pd": 9, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187668"], "sources": ["automation", "params-visual"]}, {"pd": 10, "type": "string", "meaning": "画框图片名(ConvertPictureFrameImageName)", "values": null, "confidence": "high", "evidence": ["0x3190240"], "sources": ["automation", "params-visual"]}]

## specialEffectPuase
- handler: `0x3187604` case_entry: `0x317d878` verify: `0x31875fc` hash: `0xc622e861` min_token: 9
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertNameString", "evidence": "0x3187624"}, {"index": 2, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x31876bc"}, {"index": 4, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x31876e0"}, {"index": 6, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x3187764"}]
- command_params.json: handler=0x3187604 optional_pd=[2, 4, 6, 8, 10] shared_tail=None
- context_apis: ["ScriptManager$$ConvertNameString", "ScriptManager$$ScriptCommandExecute", "ScriptPosition$$GetPosition", "ScriptManager$$ConvertColor"]
- params: [{"pd": 0, "type": "string", "meaning": "资源/立绘名", "values": null, "confidence": "high", "evidence": ["0x3187624", 51934756], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187668"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "?", "meaning": "未知", "values": null, "confidence": "low", "evidence": ["0x31876bc"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 `,`(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187668"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "Vector3", "meaning": "传给 CreateMainEffect() 的参数 `pos.hfa`", "values": null, "confidence": "medium", "evidence": ["0x31876e0", "0x3188e54"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187668"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "翻转/朝向(H/V/F/其他)", "values": null, "confidence": "medium", "evidence": ["0x3187764", "0x318f4e8"], "sources": ["automation", "params-visual"]}, {"pd": 7, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187668"], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "string", "meaning": "颜色(名称或 #RRGGBB)", "values": null, "confidence": "high", "evidence": ["0x31877b8", 51935160], "sources": ["automation", "params-visual"]}, {"pd": 9, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3187668"], "sources": ["automation", "params-visual"]}, {"pd": 10, "type": "string", "meaning": "画框图片(Image/<name>)", "values": null, "confidence": "medium", "evidence": ["0x3190240"], "sources": ["automation", "params-visual"]}]

## specialEffectStart
- handler: `0x318290c` case_entry: `0x317da80` verify: `0x3182904` hash: `0x6982d753` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertNameString", "evidence": "0x318292c"}]
- command_params.json: handler=0x318290c optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertNameString"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(ConvertNameString→Resume)", "values": null, "confidence": "high", "evidence": ["0x318292c", 51915052], "sources": ["automation", "params-visual"]}]

## specialEffectStop
- handler: `0x317c6d8` case_entry: `0x317c6a8` verify: `0x317c6cc` hash: `0x13048b21` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertNameString", "evidence": "0x317c6f8"}]
- command_params.json: handler=0x317c6d8 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertNameString"]
- params: [{"pd": 0, "type": "string", "meaning": "特效名(ConvertNameString)", "values": null, "confidence": "high", "evidence": ["0x317c6f8", 51889912], "sources": ["automation", "params-visual"]}]
