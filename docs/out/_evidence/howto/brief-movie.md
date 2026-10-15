# 简报: cluster `movie`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## criMovie
- handler: `0x3183c38` case_entry: `0x317a110` verify: `0x3183c30` hash: `0x1dcc0581` min_token: None
- commands.json params: []
- command_params.json: handler=0x3183c38 optional_pd=[2, 3] shared_tail=None
- context_apis: ["ScriptManager$$IsFastPlaySpeed", "ScriptManager$$IsJumpLine", "ScriptManager$$ConvertCRIMovieName", "ScriptManager$$PlayCRIMovie", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed", "ScriptManager$$GetFSCommandOffsetX", "ScriptCharaData$$MovePositionEase"]
- params: [{"pd": 0, "type": "string", "meaning": "影片名（CRI）", "values": "资源名", "confidence": "medium", "evidence": ["0x3183c38", 51920472], "sources": ["automation", "params-misc"]}]

## movie
- handler: `0x3183c38` case_entry: `0x317e3ac` verify: `0x3183c30` hash: `0xaef39ccf` min_token: None
- commands.json params: []
- command_params.json: handler=0x3183c38 optional_pd=[2, 3] shared_tail=None
- context_apis: ["ScriptManager$$IsFastPlaySpeed", "ScriptManager$$IsJumpLine", "ScriptManager$$ConvertCRIMovieName", "ScriptManager$$PlayCRIMovie", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed", "ScriptManager$$GetFSCommandOffsetX", "ScriptCharaData$$MovePositionEase"]
- params: [{"pd": 0, "type": "string", "meaning": "影片名（CRI）", "values": "资源名", "confidence": "medium", "evidence": [51920472, "handler 头部 pd0 消费（ConvertCRIMovieName）"], "sources": ["automation", "params-misc"]}]
