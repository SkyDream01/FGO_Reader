# 简报: cluster `branch`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## branchHaveSvtEquip
- handler: `0x318459c` case_entry: `0x317ab50` verify: `0x3184594` hash: `0x271b37fa` min_token: 3
- commands.json params: []
- command_params.json: handler=0x318459c optional_pd=[1, 2] shared_tail=None
- context_apis: ["SoundManager$$isPlayJingle", "ScriptMessageCommonManager$$SetBetweenLineHeight", "ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$SetFace", "ScriptManager$$ConvertNameString", "ScriptActionAdvPrefabController$$SetShow", "ScriptManager$$InitWipe", "ScriptManager$$ConvertTalkEffectName"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51922684, 51922960, 51923148, 51923340], "meaning": "传给 isPlayJingle() 的参数 `name`(string)", "conv": ["SoundManager$$isPlayJingle", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 2, "type": "int", "meaning": "装备/礼装编号（int）", "values": "整数", "confidence": "medium", "evidence": ["0x31845ec Int32::Parse"], "sources": ["automation", "params-misc"]}]

## branchMaterial
- handler: `0x31802b0` case_entry: `0x317da54` verify: `0x31802a4` hash: `0xa9c7db00` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "op_Equality", "evidence": "0x3193e04"}]
- command_params.json: handler=0x31802b0 optional_pd=[1, 2] shared_tail=0x3184684
- context_apis: []
- params: [{"pd": 0, "type": "unknown", "consumer": "op_Equality", "evidence": ["0x3193e04", 51922684, 51922960], "meaning": "传给 isPlayJingle() 的参数 `name`(string)", "conv": ["SoundManager$$isPlayJingle", "ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}]

## branchNotHaveSvtEquip
- handler: `0x318459c` case_entry: `0x317cce4` verify: `0x3184594` hash: `0x4e750e71` min_token: 3
- commands.json params: []
- command_params.json: handler=0x318459c optional_pd=[1, 2] shared_tail=None
- context_apis: ["SoundManager$$isPlayJingle", "ScriptMessageCommonManager$$SetBetweenLineHeight", "ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$SetFace", "ScriptManager$$ConvertNameString", "ScriptActionAdvPrefabController$$SetShow", "ScriptManager$$InitWipe", "ScriptManager$$ConvertTalkEffectName"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51922684, 51922960, 51923148, 51923340], "meaning": "传给 isPlayJingle() 的参数 `name`(string)", "conv": ["SoundManager$$isPlayJingle", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 2, "type": "int", "meaning": "装备/礼装编号（int）", "values": "整数", "confidence": "medium", "evidence": ["0x31845ec"], "sources": ["automation", "params-misc"]}]

## branchNotMaterial
- handler: `0x31802b0` case_entry: `0x317b048` verify: `0x31802a4` hash: `0x1604056f` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "op_Equality", "evidence": "0x3193e04"}]
- command_params.json: handler=0x31802b0 optional_pd=[1, 2] shared_tail=0x3184684
- context_apis: []
- params: [{"pd": 0, "type": "unknown", "consumer": "op_Equality", "evidence": ["0x3193e04", 51922684, 51922960], "meaning": "传给 isPlayJingle() 的参数 `name`(string)", "conv": ["SoundManager$$isPlayJingle", "ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}]

## branchNotRouteSelect
- handler: `0x31834e4` case_entry: `0x317c768` verify: `0x31834dc` hash: `0x53f0f90b` min_token: 5
- commands.json params: []
- command_params.json: handler=0x31834e4 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$GetQuestId", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed", "ScriptPosition$$GetPosition", "ScriptCharaData$$StartRollEx"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51918588], "meaning": "角色槽位索引(把 A-Z / 数字转成槽位号)", "conv": ["ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 4, "type": "int", "meaning": "路线 ID（int）", "values": "整数", "confidence": "medium", "evidence": ["0x3183588"], "sources": ["automation", "params-misc"]}]

## branchNotRouteSelectCount
- handler: `0x317c85c` case_entry: `0x3179a30` verify: `0x317c850` hash: `0xf3fd2b9a` min_token: 9
- commands.json params: []
- command_params.json: handler=0x317c85c optional_pd=[1, 2, 4, 6] shared_tail=None
- context_apis: ["ScriptManager$$GetQuestId", "ScriptManager$$IsExistTargetSubLayerGroup", "ScriptManager$$ConvertNameString"]
- params: [{"pd": 0, "type": "string", "meaning": "比较表达式/标签", "values": "—", "confidence": "low", "evidence": ["0x317ca04", 51891240], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "int", "meaning": "数量（int）", "values": "整数", "confidence": "medium", "evidence": ["0x317c904"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "int/enum", "meaning": "枚举/比较符", "values": "—", "confidence": "medium", "evidence": ["0x317c978"], "sources": ["automation", "params-misc"]}]

## branchRouteSelect
- handler: `0x31834e4` case_entry: `0x317ea7c` verify: `0x31834dc` hash: `0x81e06266` min_token: 5
- commands.json params: []
- command_params.json: handler=0x31834e4 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$GetQuestId", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed", "ScriptPosition$$GetPosition", "ScriptCharaData$$StartRollEx"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51918588], "meaning": "角色槽位索引(把 A-Z / 数字转成槽位号)", "conv": ["ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 4, "type": "int", "meaning": "路线 ID（int）", "values": "整数", "confidence": "medium", "evidence": ["0x3183588 Int32::Parse"], "sources": ["automation", "params-misc"]}]

## branchRouteSelectCount
- handler: `0x317c85c` case_entry: `0x317c82c` verify: `0x317c850` hash: `0xb55797f5` min_token: 9
- commands.json params: []
- command_params.json: handler=0x317c85c optional_pd=[1, 2, 4, 6] shared_tail=None
- context_apis: ["ScriptManager$$GetQuestId", "ScriptManager$$IsExistTargetSubLayerGroup", "ScriptManager$$ConvertNameString"]
- params: [{"pd": 0, "type": "string", "meaning": "比较表达式/标签（String::Equals）", "values": "—", "confidence": "low", "evidence": ["0x317ca04 String::Equals", 51891240], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "int", "meaning": "数量（int）", "values": "整数", "confidence": "medium", "evidence": ["0x317c904 Int32::Parse"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "int/enum", "meaning": "枚举/比较符（Enum.Parse）", "values": "—", "confidence": "medium", "evidence": ["0x317c978 Enum::Parse"], "sources": ["automation", "params-misc"]}]

## branchSetGrandSvtCount
- handler: `0x317e20c` case_entry: `0x317e1dc` verify: `0x317e200` hash: `0x3845f2b1` min_token: 5
- commands.json params: []
- command_params.json: handler=0x317e20c optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ConvertNameString", "SoundManager$$changeVolumeVoice"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51897448], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 2, "type": "int", "meaning": "数量（int）", "values": "整数", "confidence": "medium", "evidence": ["0x317e288 Int32::Parse"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "int/enum", "meaning": "枚举/比较符", "values": "—", "confidence": "medium", "evidence": ["0x317e2fc Enum::Parse"], "sources": ["automation", "params-misc"]}]
