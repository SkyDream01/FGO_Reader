# 简报: cluster `chara_loop`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## charaFadeSpeed
- handler: `0x3180e44` case_entry: `0x317bcf8` verify: `0x3180e3c` hash: `0x9ea38ea5` min_token: 5
- commands.json params: []
- command_params.json: handler=0x3180e44 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed", "ScriptCharaData$$MoveAlphaSpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3180ec0", 51908288], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3180e6c"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "?", "meaning": "淡入速度倍率/秒", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3180e6c"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "?", "meaning": "附加参数(未消费时忽略)", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}]

## charaFadeTimeLoop
- handler: `0x3182fa0` case_entry: `0x317df50` verify: `0x3182f98` hash: `0xf71d4141` min_token: 9
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "op_Inequality", "evidence": "0x3182fe0"}]
- command_params.json: handler=0x3182fa0 optional_pd=[1, 2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$SetDepth", "ScriptManager$$InitMask", "ScriptManager$$IsExistTargetSubLayerGroup", "ScriptCharaData$$IsLoad"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3182fe0", "0x318c09c", 51917168], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3182fe0"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "?", "meaning": "循环淡出时间(秒)", "values": null, "confidence": "low", "evidence": ["0x318d2b8"], "sources": ["automation", "params-visual"]}, {"pd": 20, "type": "string", "meaning": "附加参数(超出常规布局,含义未证实)", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}]

## charaFadeTimeLoopStop
- handler: `0x31889d8` case_entry: `0x317e84c` verify: `0x31889d0` hash: `0x47259261` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "StopMoveAlphaLoop", "evidence": "0x3188a20"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x31889f8"}]
- command_params.json: handler=0x31889d8 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$StopMoveAlphaLoop"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x31889f8", "0x3188a20", 51939832], "sources": ["automation", "params-visual"]}]

## charaReturn
- handler: `0x317a3ac` case_entry: `0x317a37c` verify: `0x317a3a0` hash: `0x446cbd2a` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x317a3cc"}]
- command_params.json: handler=0x317a3ac optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317a3cc", 51880908], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "string", "meaning": "首字符必须为 ' '(格式校验)", "values": null, "confidence": "high", "evidence": ["0x317a414"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "?", "meaning": "未知", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}]

## charaRollAxisLoopStop
- handler: `0x3185968` case_entry: `0x317c5b0` verify: `0x3185960` hash: `0xa29f5c88` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "IsFastPlaySpeed", "evidence": "0x31859b4"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x3185988"}]
- command_params.json: handler=0x3185968 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsFastPlaySpeed", "ScriptCharaData$$StopRollAxisLoop"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3185988", "0x31859b4", 51927432], "sources": ["automation", "params-visual"]}]
