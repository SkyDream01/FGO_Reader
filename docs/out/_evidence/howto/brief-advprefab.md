# 简报: cluster `advprefab`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## advActorHide
- handler: `0x317f138` case_entry: `0x317955c` verify: `0x317f12c` hash: `0xf0f908b` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertNameString", "evidence": "0x317f168"}]
- command_params.json: handler=0x317f138 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertNameString", "ScriptActionAdvPrefabController$$SetHide"]
- params: [{"pd": 0, "type": "string", "meaning": "对象/演员名(ConvertNameString)", "values": null, "confidence": "high", "evidence": ["0x317f168", 51900776], "sources": ["automation", "params-visual"]}]

## advActorShow
- handler: `0x318489c` case_entry: `0x317b0d8` verify: `0x3184894` hash: `0x55bc150e` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertNameString", "evidence": "0x31848cc"}]
- command_params.json: handler=0x318489c optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertNameString", "ScriptActionAdvPrefabController$$SetShow"]
- params: [{"pd": 0, "type": "string", "meaning": "对象/演员名(ConvertNameString)", "values": null, "confidence": "high", "evidence": ["0x31848cc", 51923148], "sources": ["automation", "params-visual"]}]

## advPlayAnimator
- handler: `0x318267c` case_entry: `0x317d828` verify: `0x3182674` hash: `0x4c63a509` min_token: None
- commands.json params: []
- command_params.json: handler=0x318267c optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$IsJumpLine", "ScriptManager$$ConvertNameString", "ScriptActionAdvPrefabController$$PlayAnimator"]
- params: [{"pd": 0, "type": "string", "meaning": "对象名", "values": null, "confidence": "high", "evidence": ["0x31826c0", 51914432], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "动画触发器名(PlayAnimator.trigger)", "values": null, "confidence": "high", "evidence": ["0x31826fc", 51914472], "sources": ["automation", "params-visual"]}]

## advPrepare
- handler: `0x317d14c` case_entry: `0x317d11c` verify: `0x317d140` hash: `0xf1787bc1` min_token: None
- commands.json params: []
- command_params.json: handler=0x317d14c optional_pd=[] shared_tail=None
- context_apis: ["ScriptActionAdvPrefabController$$Prepare"]
- params: [{"pd": 0, "type": "string", "meaning": "对象名(Prepare.objectName)", "values": null, "confidence": "high", "evidence": ["0x317d174", 51892596], "sources": ["automation", "params-visual"]}]

## advRelease
- handler: `0x31839d8` case_entry: `0x3179dbc` verify: `0x31839d0` hash: `0xa9e91acb` min_token: None
- commands.json params: []
- command_params.json: handler=0x31839d8 optional_pd=[] shared_tail=None
- context_apis: ["ScriptActionAdvPrefabController$$Release", "ScriptManager.<>c__DisplayClass808_5$$.ctor", "ScriptSubLayerManager$$GetScriptSubLayer", "ScriptActionRenderEffectController.StopFunction$$.ctor", "ScriptActionRenderEffectController$$StopGaussianBlur", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$IsJumpLine", "ScriptManager$$ConvertCRIMovieName", "ScriptManager$$PlayCRIMovie"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51919612], "meaning": "传给 GetScriptSubLayer() 的参数 `layerKey`(string)", "conv": ["ScriptSubLayerManager$$GetScriptSubLayer"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## advSet
- handler: `0x317ec04` case_entry: `0x3179180` verify: `0x317ebf8` hash: `0x4799d20a` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "GetAssetName", "evidence": "0x317ec30"}]
- command_params.json: handler=0x317ec04 optional_pd=[] shared_tail=None
- context_apis: ["ScriptActionAdvPrefabController$$GetAssetName", "ScriptActionAdvPrefabController$$Setup"]
- params: [{"pd": 0, "type": "string", "meaning": "资源基名(GetAssetName.baseName)", "values": null, "confidence": "high", "evidence": ["0x317ec30", 51899440], "sources": ["automation", "params-visual"]}]
