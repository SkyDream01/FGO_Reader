# 简报: cluster `communication`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## communicationChara
- handler: `0x317ef18` case_entry: `0x31794f4` verify: `0x317ef0c` hash: `0xe685d03e` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x317ef34"}]
- command_params.json: handler=0x317ef18 optional_pd=[2, 6, 8, 10] shared_tail=None
- context_apis: ["ScriptPosition$$GetPosition", "ScriptManager$$ConvertNameString", "ScriptActionAdvPrefabController$$SetHide", "ScriptManager$$ModifyPlaySpeed", "ScriptManager$$SetCameraFilter"]
- params: [{"pd": 0, "type": "string", "meaning": "子层名(#A 等)", "values": null, "confidence": "medium", "evidence": ["0x317ef34", "0x318f878", 51900776], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317ef74"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "float", "meaning": "时长(秒)", "values": null, "confidence": "medium", "evidence": ["0x3192630"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317ef74"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "float", "meaning": "目标 alpha(0-1)", "values": null, "confidence": "medium", "evidence": ["0x3192630"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317ef74"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "翻转/朝向(H/V/F/其他)", "values": null, "confidence": "medium", "evidence": ["0x318f054"], "sources": ["automation", "params-visual"]}, {"pd": 7, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317ef74"], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "string", "meaning": "翻转/朝向(H/V/F/其他)", "values": null, "confidence": "medium", "evidence": ["0x319258c"], "sources": ["automation", "params-visual"]}, {"pd": 9, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317ef74"], "sources": ["automation", "params-visual"]}]

## communicationCharaClear
- handler: `0x318670c` case_entry: `0x317ccd4` verify: `0x3186704` hash: `0x4d505e0f` min_token: None
- commands.json params: []
- command_params.json: handler=0x318670c optional_pd=[2] shared_tail=None
- context_apis: ["CommonEffectManager$$Destroy", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptManager$$IsFastPlaySpeed", "ScriptCharaData$$ResumeSpecialEffect", "ScriptManager$$IsNormalPlaySpeed", "ScriptPosition$$GetPosition"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51930996], "meaning": "角色槽位索引(把 A-Z / 数字转成槽位号)", "conv": ["ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51931112], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## communicationCharaFace
- handler: `0x317d044` case_entry: `0x317d014` verify: `0x317d038` hash: `0x6d7b8a87` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x317d0ac"}]
- command_params.json: handler=0x317d044 optional_pd=[] shared_tail=None
- context_apis: ["CommonEffectManager$$Get", "ScriptActionAdvPrefabController$$Prepare"]
- params: [{"pd": 0, "type": "string", "meaning": "表情类型(Face.Type;SetFace.faceType)", "values": null, "confidence": "high", "evidence": ["0x317d0ac", "0x317d0f4", 51892596], "sources": ["automation", "params-visual"]}]

## communicationCharaLoop
- handler: `0x317ef18` case_entry: `0x317dd70` verify: `0x317ef0c` hash: `0xdc96d1c4` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x317ef34"}]
- command_params.json: handler=0x317ef18 optional_pd=[2, 6, 8, 10] shared_tail=None
- context_apis: ["ScriptPosition$$GetPosition", "ScriptManager$$ConvertNameString", "ScriptActionAdvPrefabController$$SetHide", "ScriptManager$$ModifyPlaySpeed", "ScriptManager$$SetCameraFilter"]
- params: [{"pd": 0, "type": "string", "meaning": "子层名(#A 等)", "values": null, "confidence": "medium", "evidence": ["0x317ef34", "0x318f878", 51900776], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317ef74"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "float", "meaning": "时长(秒)", "values": null, "confidence": "medium", "evidence": ["0x3192630"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317ef74"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "float", "meaning": "目标 alpha(0-1)", "values": null, "confidence": "medium", "evidence": ["0x3192630"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317ef74"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "翻转/朝向(H/V/F/其他)", "values": null, "confidence": "medium", "evidence": ["0x318f054"], "sources": ["automation", "params-visual"]}, {"pd": 7, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317ef74"], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "string", "meaning": "翻转/朝向(H/V/F/其他)", "values": null, "confidence": "medium", "evidence": ["0x319258c"], "sources": ["automation", "params-visual"]}, {"pd": 9, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317ef74"], "sources": ["automation", "params-visual"]}]

## communicationCharaStop
- handler: `0x3181d7c` case_entry: `0x317cbc8` verify: `0x3181d74` hash: `0xa10d876` min_token: None
- commands.json params: []
- command_params.json: handler=0x3181d7c optional_pd=[2, 4, 6] shared_tail=None
- context_apis: ["CommonEffectManager$$Stop", "SoundManager$$changeVolumeSe", "ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$StopMoveRelativePositionLoop", "BgmManager$$Enable_KeepSubBgm", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51912360, 51912584], "meaning": "传给 changeVolumeSe() 的参数 `name`(string)", "conv": ["SoundManager$$changeVolumeSe", "ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]
