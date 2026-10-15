# 简报: cluster `menu`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## menu
- handler: `0x317fa74` case_entry: `0x317a17c` verify: `0x317fa68` hash: `0x99e4dd3a` min_token: None
- commands.json params: []
- command_params.json: handler=0x317fa74 optional_pd=[1] shared_tail=None
- context_apis: ["ScriptManager$$ConvertNameString"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51903340], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}, {"pd": 2, "type": "string", "meaning": "菜单标签名", "values": "标签名", "confidence": "medium", "evidence": ["0x317fb6c/0x317fba8 ConvertNameString→menuLabelList"], "sources": ["automation", "params-misc"]}]

## notification
- handler: `0x317af78` case_entry: `0x317af48` verify: `0x317af6c` hash: `0xea3d3046` min_token: 3
- commands.json params: []
- command_params.json: handler=0x317af78 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertNameString"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51884060], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51883980], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}]

## selectionCentering
- handler: `0x317f90c` case_entry: `0x3179c5c` verify: `0x317f900` hash: `0x2b7bb164` min_token: 1
- commands.json params: []
- command_params.json: handler=0x317f90c optional_pd=[1] shared_tail=None
- context_apis: ["ScriptMessageCommonManager$$CalcMessageVerticalAlign", "ScriptManager$$ConvertNameString", "ScriptSubLayerManager$$GetScriptSubLayer", "ScriptSubLayer$$ShakeStop"]
- params: [{"pd": 0, "type": "bool", "meaning": "是否居中", "values": "true/false（Boolean.TryParse）", "confidence": "high", "evidence": ["0x317f948", "0x317f948 Boolean::TryParse→[x19,#0x58]→0x90", 51903340, 51903520], "sources": ["automation", "params-misc", "params-visual"]}]

## switchCase
- handler: `0x31875c4` case_entry: `0x317d818` verify: `0x31875bc` hash: `0x4b951a35` min_token: None
- commands.json params: []
- command_params.json: handler=0x31875c4 optional_pd=[2, 4, 6, 8, 10] shared_tail=None
- context_apis: ["ScriptManager$$JumpScriptCommand", "ScriptManager$$ConvertNameString", "ScriptManager$$ScriptCommandExecute", "ScriptPosition$$GetPosition", "ScriptManager$$ConvertColor", "ScriptManager$$ConvertCharaIndex", "ScriptMessageCommonManager$$SetFontSize"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51934756, 51935360, 51935568], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString", "ScriptManager$$ConvertCharaIndex", "ScriptMessageCommonManager$$SetFontSize"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 8, "type": "string", "consumer": null, "evidence": [51935160], "meaning": "颜色([#RRGGBB] / 名称)", "conv": ["ScriptManager$$ConvertColor"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## switchCaseEnd
- handler: `0x3188c58` case_entry: `0x317eb50` verify: `0x3188c50` hash: `0xfe9f10da` min_token: None
- commands.json params: []
- command_params.json: handler=0x3188c58 optional_pd=[1, 2, 4, 6] shared_tail=None
- context_apis: ["ScriptMessageCommonManager$$SetFontSize", "ScriptMessageCommonManager$$SetSpeed", "ScriptMessageCommonManager$$SetBetweenLineHeight", "ScriptLogMessage$$SetBetweenLineHeight", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$IsNormalPlaySpeed", "ScriptManager$$ConvertNameString", "ScriptCharaData$$ChangeCharacter", "ScriptManager$$ModifyPlaySpeed", "ScriptManager$$StartMask", "ScriptManager$$StartStretch"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51941900], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51941632], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "high", "sources": ["automation"], "confidence_note": "受限扫描"}]
