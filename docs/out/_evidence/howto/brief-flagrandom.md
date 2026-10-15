# 简报: cluster `flagrandom`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## flagRandom
- handler: `0x3184ed4` case_entry: `0x317bab8` verify: `0x3184ecc` hash: `0xacf5d138` min_token: 5
- commands.json params: []
- command_params.json: handler=0x3184ed4 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$SearchFlag"]
- params: [{"pd": 0, "type": "string", "meaning": "flag 名", "values": "flag 名", "confidence": "high", "evidence": ["0x3184f50 SearchFlag", 51924816], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "int", "meaning": "随机下限/权重", "values": "整数", "confidence": "medium", "evidence": ["0x3184f80 SetRahdom(arg1)"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "int", "meaning": "随机上限", "values": "整数", "confidence": "medium", "evidence": ["0x3184f80 SetRahdom(arg2)"], "sources": ["automation", "params-misc"]}]
