# 简报: cluster `capture`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## backCameraColor
- handler: `0x317cb6c` case_entry: `0x317cb3c` verify: `0x317cb60` hash: `0xf4951da4` min_token: 1
- commands.json params: []
- command_params.json: handler=0x317cb6c optional_pd=[1] shared_tail=None
- context_apis: ["ScriptManager$$ConvertNameString"]
- params: [{"pd": 0, "type": "string", "meaning": "'false'=关闭(相机 clearFlags=SolidColor=3);其他=颜色", "values": null, "confidence": "high", "evidence": ["0x317cb94", 51891240], "sources": ["automation", "params-visual"]}]

## capture
- handler: `0x3181454` case_entry: `0x317c170` verify: `0x318144c` hash: `0xfc9819c1` min_token: None
- commands.json params: []
- command_params.json: handler=0x3181454 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed", "ScriptMessageCommonManager$$OffScreen", "ScriptMessageCommonManager$$ClearText", "ScriptLogMessage$$ReturnText", "ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$SetScale"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51909860, 51910132], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51910392], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 4, "type": "string", "meaning": "截图/渲染目标相关字符串", "values": null, "confidence": "low", "evidence": ["0x318d2b8"], "sources": ["automation", "params-visual"]}]

## captureRelease
- handler: `0x31823a4` case_entry: `0x317d570` verify: `0x318239c` hash: `0x7f05cc22` min_token: None
- commands.json params: []
- command_params.json: handler=0x31823a4 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed", "CommonEffectManager$$Resume", "ScriptManager$$ConvertNameString", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed", "ScriptCharaData$$MoveScale", "ScriptManager$$IsJumpLine", "ScriptActionAdvPrefabController$$PlayAnimator", "ScriptMessageCommonManager$$SetForcedDisableTurnPage", "ScriptManager$$GetNextDelayEnd"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51913872, 51914012, 51914188], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$ConvertNameString", "ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51914472], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## useSimpleMeshFigure
- handler: `0x317ba14` case_entry: `0x317b9e4` verify: `0x317ba08` hash: `0x355910af` min_token: None
- commands.json params: []
- command_params.json: handler=0x317ba14 optional_pd=[] shared_tail=0x3193f04
- context_apis: []
- params: [{"pd": 0, "type": "string", "meaning": "立绘资源名(ConvertNameString,逗号分隔多项)", "values": null, "confidence": "high", "evidence": ["0x317a074"], "sources": ["automation", "params-visual"]}]
