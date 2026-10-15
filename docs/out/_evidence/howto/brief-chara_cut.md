# 简报: cluster `chara_cut`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## charaAttack
- handler: `0x3186270` case_entry: `0x317c7d0` verify: `0x3186268` hash: `0x3af68b60` min_token: 5
- commands.json params: []
- command_params.json: handler=0x3186270 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x31862ec", 51929836], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3186298"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "攻击动作/特效名(ScriptCharaData.MoveAttack 第 1 参)", "values": null, "confidence": "high", "evidence": ["0x31863d0 / 0x3192cc0"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3186298"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "int", "meaning": "目标 X 坐标", "values": null, "confidence": "high", "evidence": ["0x31863cc"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "string", "meaning": "首字符必须为 ','(格式校验)", "values": null, "confidence": "high", "evidence": ["0x3186334"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "int", "meaning": "目标 Y 坐标", "values": null, "confidence": "high", "evidence": ["0x31863f4"], "sources": ["automation", "params-visual"]}, {"pd": 7, "type": "string", "meaning": "首字符必须为 ' '(格式校验)", "values": null, "confidence": "high", "evidence": ["0x3186368"], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "float", "meaning": "时长(秒;MoveAttack 第 4 参)", "values": null, "confidence": "high", "evidence": ["0x31863a0"], "sources": ["automation", "params-visual"]}]

## charaCutStop
- handler: `0x31857a8` case_entry: `0x317c370` verify: `0x31857a0` hash: `0x485b96b4` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "StopCut", "evidence": "0x31857f0"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x31857c8"}]
- command_params.json: handler=0x31857a8 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$StopCut"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x31857c8", "0x31857f0", 51926984], "sources": ["automation", "params-visual"]}]

## charaCutin
- handler: `0x31855fc` case_entry: `0x317c100` verify: `0x31855f4` hash: `0x809ac7b3` min_token: 5
- commands.json params: []
- command_params.json: handler=0x31855fc optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptManager$$IsFastPlaySpeed", "ScriptCharaData$$SetCutin"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3185678", 51926648], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x3185624"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "立绘/图片名(ConvertNameString)", "values": null, "confidence": "high", "evidence": ["0x31856bc", 51926716], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x3185650"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "float", "meaning": "时长(秒)", "values": null, "confidence": "high", "evidence": ["0x31856d8"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "float", "meaning": "第二时长/速度(秒;可选)", "values": null, "confidence": "medium", "evidence": ["0x3185700"], "sources": ["automation", "params-visual"]}]

## charaCutinPause
- handler: `0x31855fc` case_entry: `0x317c778` verify: `0x31855f4` hash: `0x54abe85b` min_token: 5
- commands.json params: []
- command_params.json: handler=0x31855fc optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptManager$$IsFastPlaySpeed", "ScriptCharaData$$SetCutin"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3185678", 51926648], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x3185624"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "立绘/图片名(ConvertNameString)", "values": null, "confidence": "high", "evidence": ["0x31856bc", 51926716], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 `' '`", "values": null, "confidence": "high", "evidence": ["0x3185650"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "float", "meaning": "时长(秒)", "values": null, "confidence": "high", "evidence": ["0x31856d8"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "float", "meaning": "第二时长/速度(秒;可选)", "values": null, "confidence": "medium", "evidence": ["0x3185700"], "sources": ["automation", "params-visual"]}]

## charaCutinStart
- handler: `0x317d9c8` case_entry: `0x317d998` verify: `0x317d9bc` hash: `0x2a64c021` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "IsFastPlaySpeed", "evidence": "0x317da1c"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x317d9e8"}]
- command_params.json: handler=0x317d9c8 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsFastPlaySpeed", "ScriptCharaData$$ResumeCutin"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317d9e8", "0x317da1c", 51894760], "sources": ["automation", "params-visual"]}]

## charaCutout
- handler: `0x317dc8c` case_entry: `0x317dc5c` verify: `0x317dc80` hash: `0x595168a0` min_token: 3
- commands.json params: []
- command_params.json: handler=0x317dc8c optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsFastPlaySpeed", "ScriptCharaData$$SetCutout"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317dcdc", 51895516], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317dcb4"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "?", "meaning": "裁剪参数(未消费;仅 0x318f144 处比较)", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}]
