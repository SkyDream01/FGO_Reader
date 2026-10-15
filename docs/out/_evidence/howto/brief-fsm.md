# 简报: cluster `fsm`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## fsmObjDestroy
- handler: `0x317aba0` case_entry: `0x317ab70` verify: `0x317ab94` hash: `0x284081d0` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "Destroy", "evidence": "0x317abec"}, {"index": 0, "name": null, "type": "int", "consumer": "ConvertCharaIndex", "evidence": "0x317abc0"}]
- command_params.json: handler=0x317aba0 optional_pd=[] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptFsmObjectData$$Destroy"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317abc0", "0x317abec", 51882944], "sources": ["automation", "params-visual"]}]

## fsmObjLayer
- handler: `0x317f638` case_entry: `0x3179ab8` verify: `0x317f62c` hash: `0x8afb97c3` min_token: 3
- commands.json params: []
- command_params.json: handler=0x317f638 optional_pd=[2, 3] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptFsmObjectData$$SetParent", "ScriptFsmObjectData$$SetPosition"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317f688", 51902088], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317f660"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "层名('ui' 等)", "values": null, "confidence": "high", "evidence": ["0x317f6d4"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "层名/层级参数", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "string", "meaning": "首字符必须为 ','(格式校验)", "values": null, "confidence": "high", "evidence": ["0x317f724"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "附加参数", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}]

## fsmObjSendEvent
- handler: `0x3185e08` case_entry: `0x31799d4` verify: `0x3185e00` hash: `0x73600b4c` min_token: 3
- commands.json params: []
- command_params.json: handler=0x3185e08 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ModifyPlaySpeed", "ScriptManager$$ConvertCharaIndex", "ScriptFsmObjectData$$SetState"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3185e68", 51928680], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3185e40"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "事件名(Fsm.SendEvent)", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}]

## fsmObjSet
- handler: `0x317c248` case_entry: `0x317c218` verify: `0x317c23c` hash: `0x8643a3f6` min_token: 5
- commands.json params: []
- command_params.json: handler=0x317c248 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptFsmObjectData$$Destroy", "ScriptFsmObjectData$$.ctor"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x317c298", 51888792], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317c270"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "变量名(Fsm 变量)", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "变量值", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}]

## fsmObjSetBool
- handler: `0x3182adc` case_entry: `0x317dc10` verify: `0x3182ad4` hash: `0x996d981a` min_token: 5
- commands.json params: []
- command_params.json: handler=0x3182adc optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptFsmObjectData$$SetString"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3182b2c", 51915564], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3182b04"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "变量名", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "bool", "meaning": "布尔值(true/false)", "values": null, "confidence": "high", "evidence": ["0x318bebc"], "sources": ["automation", "params-visual"]}]

## fsmObjSetFloat
- handler: `0x3182adc` case_entry: `0x3179364` verify: `0x3182ad4` hash: `0x25392b7c` min_token: 5
- commands.json params: []
- command_params.json: handler=0x3182adc optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptFsmObjectData$$SetString"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3182b2c", 51915564], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3182b04"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "变量名", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "float", "meaning": "浮点值", "values": null, "confidence": "high", "evidence": ["0x318bebc"], "sources": ["automation", "params-visual"]}]

## fsmObjSetState
- handler: `0x3185e08` case_entry: `0x317c714` verify: `0x3185e00` hash: `0x94ce0aeb` min_token: 3
- commands.json params: []
- command_params.json: handler=0x3185e08 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ModifyPlaySpeed", "ScriptManager$$ConvertCharaIndex", "ScriptFsmObjectData$$SetState"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3185e68", 51928680], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3185e40"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "状态名(Fsm.SetState)", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}]

## fsmObjSetString
- handler: `0x3182adc` case_entry: `0x31791fc` verify: `0x3182ad4` hash: `0xbf98a387` min_token: 5
- commands.json params: []
- command_params.json: handler=0x3182adc optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptFsmObjectData$$SetString"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3182b2c", 51915564], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3182b04"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "变量名", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "string", "meaning": "字符串值", "values": null, "confidence": "high", "evidence": ["0x318bebc"], "sources": ["automation", "params-visual"]}]
