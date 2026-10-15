# 简报: cluster `distortion`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## charaMask
- handler: `0x3183f88` case_entry: `0x317a22c` verify: `0x3183f80` hash: `0x597c9aa4` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x3183fa8"}]
- command_params.json: handler=0x3183f88 optional_pd=[3] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3183fa8", 51920808], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "?", "meaning": "遮罩方向:'inside'/'outside'(比较@0x3183ff8/0x318da40)", "values": null, "confidence": "high", "evidence": ["0x3183ff8"], "sources": ["automation", "params-visual"]}]

## distortionloop
- handler: `0x317f1e0` case_entry: `0x3179710` verify: `0x317f1d4` hash: `0x52ded3b8` min_token: 9
- commands.json params: [{"index": 2, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x317f240"}, {"index": 4, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317f264"}, {"index": 6, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317f288"}, {"index": 8, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317f2ac"}, {"index": 10, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317f2d0"}, {"index": 12, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317f2f4"}]
- command_params.json: handler=0x317f1e0 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ModifyPlaySpeed", "ScriptManager$$SetCameraFilter", "ScriptActionRenderEffectController$$StartDistortion", "ScriptManager$$IsNormalPlaySpeed", "ScriptActionRenderEffectController$$SkipDistortion", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$StopEffect"]
- params: [{"pd": 0, "type": "float", "meaning": "滤镜参数 1(SetCameraFilter.paramsFloat 数组的首值)", "values": null, "confidence": "low", "evidence": [51901368], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "float", "meaning": "滤镜参数 2", "values": null, "confidence": "low", "evidence": ["0x317f240", 51901488], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "float", "meaning": "滤镜参数 3", "values": null, "confidence": "low", "evidence": ["0x317f264"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "float", "meaning": "滤镜参数 4", "values": null, "confidence": "low", "evidence": ["0x317f288"], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "float", "meaning": "滤镜参数 5", "values": null, "confidence": "low", "evidence": ["0x317f2ac"], "sources": ["automation", "params-visual"]}, {"pd": 10, "type": "float", "meaning": "滤镜参数 6", "values": null, "confidence": "low", "evidence": ["0x317f2d0"], "sources": ["automation", "params-visual"]}, {"pd": 12, "type": "float", "meaning": "滤镜参数 7(SetCameraFilter.paramsFloat)", "values": null, "confidence": "medium", "evidence": ["0x317b238", "0x317f2f4"], "sources": ["automation", "params-visual"]}]

## distortionstart
- handler: `0x317b128` case_entry: `0x317b0f8` verify: `0x317b11c` hash: `0x569b71d2` min_token: 9
- commands.json params: [{"index": 2, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317b188"}, {"index": 4, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317b1ac"}, {"index": 6, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317b1d0"}, {"index": 8, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317b1f4"}, {"index": 10, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317b218"}]
- command_params.json: handler=0x317b128 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ModifyPlaySpeed", "ScriptManager$$SetCameraFilter", "ScriptActionRenderEffectController$$StartDistortion", "ScriptManager$$IsNormalPlaySpeed", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$StopBackEffect"]
- params: [{"pd": 0, "type": "float", "meaning": "滤镜参数 1(SetCameraFilter.paramsFloat 数组的首值)", "values": null, "confidence": "low", "evidence": [51884800], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "float", "meaning": "滤镜参数 2", "values": null, "confidence": "low", "evidence": ["0x317b188", 51884920], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "float", "meaning": "滤镜参数 3", "values": null, "confidence": "low", "evidence": ["0x317b1ac"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "float", "meaning": "滤镜参数 4", "values": null, "confidence": "low", "evidence": ["0x317b1d0"], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "float", "meaning": "滤镜参数 5", "values": null, "confidence": "low", "evidence": ["0x317b1f4"], "sources": ["automation", "params-visual"]}, {"pd": 10, "type": "float", "meaning": "滤镜参数 6", "values": null, "confidence": "low", "evidence": ["0x317b218", "0x317b238"], "sources": ["automation", "params-visual"]}]

## distortionstop
- handler: `0x317b7ec` case_entry: `0x317b7bc` verify: `0x317b7e0` hash: `0x9239b092` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317b828"}]
- command_params.json: handler=0x317b7ec optional_pd=[] shared_tail=0x3193f00
- context_apis: []
- params: [{"pd": 0, "type": "?", "meaning": "未知", "values": null, "confidence": "low", "evidence": ["0x317b828"], "sources": ["automation", "params-visual"]}]

## spriteMaskOff
- handler: `0x3187440` case_entry: `0x317d684` verify: `0x3187438` hash: `0xfa7137f1` min_token: None
- commands.json params: []
- command_params.json: handler=0x3187440 optional_pd=[2, 4, 6, 8, 10] shared_tail=None
- context_apis: ["ScriptManager$$GetNonStopEndBgm", "ScriptManager$$SoundStopAllEnd", "ScriptManager$$JumpScriptCommand", "ScriptManager$$ConvertNameString", "ScriptManager$$ScriptCommandExecute", "ScriptPosition$$GetPosition", "ScriptManager$$ConvertColor"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51934756], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 8, "type": "string", "consumer": null, "evidence": [51935160], "meaning": "颜色([#RRGGBB] / 名称)", "conv": ["ScriptManager$$ConvertColor"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## spriteMaskSet
- handler: `0x3179ff0` case_entry: `0x3179fc0` verify: `0x3179fe4` hash: `0xeef1b964` min_token: None
- commands.json params: []
- command_params.json: handler=0x3179ff0 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertSpriteMaskName"]
- params: [{"pd": 0, "type": "string", "meaning": "精灵遮罩名(Image/mask_<name>)", "values": null, "confidence": "high", "evidence": ["0x317a03c", 51879996], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "颜色(ConvertColor)", "values": null, "confidence": "high", "evidence": ["0x318d2b8"], "sources": ["automation", "params-visual"]}]
