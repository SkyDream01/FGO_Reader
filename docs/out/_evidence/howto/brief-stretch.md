# 简报: cluster `stretch`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## screen
- handler: `0x31804c8` case_entry: `0x317b0e8` verify: `0x31804bc` hash: `0x55c54c11` min_token: 9
- commands.json params: []
- command_params.json: handler=0x31804c8 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager.<>c__DisplayClass808_4$$.ctor", "ScriptSubLayerManager$$GetScriptSubLayer", "ScriptManager$$IsNormalPlaySpeed", "ScriptManager$$ConvertTalkEffectName", "ScriptManager$$GetEffectParameter", "ScriptManager$$IsFastPlaySpeed"]
- params: [{"pd": 0, "type": "string", "meaning": "子层 key(#A 等;SetScreen)", "values": null, "confidence": "high", "evidence": ["0x31806d8", 51906264, 51906716], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x31804f0"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "int", "meaning": "x", "values": "像素", "confidence": "medium", "evidence": ["0x31805a4 Int32::Parse（SetScreen(x,y,w,h,...) 0x31dxxxx）"], "sources": ["automation", "params-misc"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x31804f0"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "int", "meaning": "y", "values": "像素", "confidence": "medium", "evidence": ["0x31805c8"], "sources": ["automation", "params-misc"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x31804f0"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "int", "meaning": "w", "values": "像素", "confidence": "medium", "evidence": ["0x31805ec"], "sources": ["automation", "params-misc"]}, {"pd": 7, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x31804f0"], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "int", "meaning": "h", "values": "像素", "confidence": "medium", "evidence": ["0x3180610"], "sources": ["automation", "params-misc"]}]

## scrollStop
- handler: `0x317f1a0` case_entry: `0x31795b8` verify: `0x317f194` hash: `0x93d86544` min_token: None
- commands.json params: []
- command_params.json: handler=0x317f1a0 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ModifyPlaySpeed", "ScriptManager$$SetCameraFilter", "ScriptActionRenderEffectController$$StartDistortion", "ScriptManager$$IsNormalPlaySpeed", "ScriptActionRenderEffectController$$SkipDistortion", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$StopEffect"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51901368], "meaning": "角色槽位索引(把 A-Z / 数字转成槽位号)", "conv": ["ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51901488], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## stretchOff
- handler: `0x3181c60` case_entry: `0x317c7a4` verify: `0x3181c58` hash: `0xd8d0d187` min_token: None
- commands.json params: []
- command_params.json: handler=0x3181c60 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$InitStretch", "ScriptManager$$SoundStopAllFade", "ScriptManager$$ConvertTalkEffectName", "CommonEffectManager$$Stop", "SoundManager$$changeVolumeSe", "ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$StopMoveRelativePositionLoop", "BgmManager$$Enable_KeepSubBgm"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51911940, 51912360, 51912584], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName", "SoundManager$$changeVolumeSe", "ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## stretchin
- handler: `0x3187cbc` case_entry: `0x317dc3c` verify: `0x3187cb4` hash: `0x57067d35` min_token: None
- commands.json params: []
- command_params.json: handler=0x3187cbc optional_pd=[1, 2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$IsMoveAlpha", "ScriptManager$$EndFlash", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$ResumeBackEffect"]
- params: [{"pd": 0, "type": "string", "meaning": "方向名(StartStretch.name)", "values": null, "confidence": "high", "evidence": ["0x3189380", 51936928], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318929c"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "float", "meaning": "时长(秒;快进/非正常速度时忽略→瞬间完成)", "values": null, "confidence": "high", "evidence": ["0x3189380", 51937368], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318929c"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "float", "meaning": "拉伸量(scale)", "values": null, "confidence": "high", "evidence": ["0x3189380"], "sources": ["automation", "params-visual"]}]

## stretchout
- handler: `0x3187cbc` case_entry: `0x317cea8` verify: `0x3187cb4` hash: `0x2db0e81e` min_token: None
- commands.json params: []
- command_params.json: handler=0x3187cbc optional_pd=[1, 2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$IsMoveAlpha", "ScriptManager$$EndFlash", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$ResumeBackEffect"]
- params: [{"pd": 0, "type": "string", "meaning": "方向名(StartStretch.name)", "values": null, "confidence": "high", "evidence": ["0x3189380", 51936928], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318929c"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "float", "meaning": "时长(秒;快进/非正常速度时忽略→瞬间完成)", "values": null, "confidence": "high", "evidence": ["0x3189380", 51937368], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x318929c"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "float", "meaning": "拉伸量(scale)", "values": null, "confidence": "high", "evidence": ["0x3189380"], "sources": ["automation", "params-visual"]}]

## subStretch
- handler: `0x3187f58` case_entry: `0x317decc` verify: `0x3187f50` hash: `0x7a7833ba` min_token: 1
- commands.json params: []
- command_params.json: handler=0x3187f58 optional_pd=[1, 2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$ConvertTalkEffectName", "ScriptCharaData$$ResumeBackEffect", "ScriptCharaData$$ResumeEffect", "ScriptManager$$ConvertInsertionAnimationName", "ScriptPosition$$GetPosition"]
- params: [{"pd": 0, "type": "string", "meaning": "'on'/'off'(ScriptSubLayerManager.SetSubStretch)", "values": null, "confidence": "high", "evidence": ["0x3187f80", 51937236, 51937712], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51937368], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## subStretchin
- handler: `0x317d3a4` case_entry: `0x317a24c` verify: `0x317d398` hash: `0x5ba5fec5` min_token: 5
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "GetScriptSubLayer", "evidence": "0x317d444"}, {"index": 4, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317d41c"}]
- command_params.json: handler=0x317d3a4 optional_pd=[4] shared_tail=None
- context_apis: ["ScriptManager$$IsNormalPlaySpeed", "ScriptSubLayerManager$$GetScriptSubLayer"]
- params: [{"pd": 0, "type": "string", "meaning": "子层 key(#A 等)", "values": null, "confidence": "high", "evidence": ["0x317d444", 51893316], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "方向名(StartSubStretch.name)", "values": null, "confidence": "high", "evidence": ["0x318ceb4"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317d3f4"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "float", "meaning": "时长(秒;快进/非正常速度时忽略→瞬间完成)", "values": null, "confidence": "high", "evidence": ["0x317d41c", "0x318ceb4"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317d3f4"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "float", "meaning": "拉伸量(scale)", "values": null, "confidence": "high", "evidence": ["0x318ceb4"], "sources": ["automation", "params-visual"]}]

## subStretchout
- handler: `0x317d3a4` case_entry: `0x317d374` verify: `0x317d398` hash: `0xe29ef44e` min_token: 5
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "GetScriptSubLayer", "evidence": "0x317d444"}, {"index": 4, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x317d41c"}]
- command_params.json: handler=0x317d3a4 optional_pd=[4] shared_tail=None
- context_apis: ["ScriptManager$$IsNormalPlaySpeed", "ScriptSubLayerManager$$GetScriptSubLayer"]
- params: [{"pd": 0, "type": "string", "meaning": "子层 key(#A 等)", "values": null, "confidence": "high", "evidence": ["0x317d444", 51893316], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "方向名(StartSubStretch.name)", "values": null, "confidence": "high", "evidence": ["0x318ceb4"], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317d3f4"], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "float", "meaning": "时长(秒;快进/非正常速度时忽略→瞬间完成)", "values": null, "confidence": "high", "evidence": ["0x317d41c", "0x318ceb4"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x317d3f4"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "float", "meaning": "拉伸量(scale)", "values": null, "confidence": "high", "evidence": ["0x318ceb4"], "sources": ["automation", "params-visual"]}]

## turnPageOff
- handler: `0x3182720` case_entry: `0x317d888` verify: `0x3182718` hash: `0xc6b33946` min_token: None
- commands.json params: []
- command_params.json: handler=0x3182720 optional_pd=[2, 3] shared_tail=None
- context_apis: ["ScriptMessageCommonManager$$SetForcedDisableTurnPage", "ScriptManager$$GetNextDelayEnd", "ScriptManager$$DelayStop", "ScriptManager$$IsMessageLine", "ScriptManager$$TDelayJumpScript", "ScriptManager$$ConvertNameString", "ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$Destroy", "ScriptManager$$IsExistTargetSubLayerGroup", "ScriptSubLayerManager$$RegistCharaData"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51915052, 51915144], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString", "ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}, {"pd": 4, "type": "string", "meaning": "颜色(ConvertColor)", "values": null, "confidence": "low", "evidence": ["0x318d2b8", 51915448], "sources": ["automation", "params-visual"]}]

## turnPageOn
- handler: `0x317d4e8` case_entry: `0x317d4b8` verify: `0x317d4dc` hash: `0x4662386c` min_token: 1
- commands.json params: []
- command_params.json: handler=0x317d4e8 optional_pd=[2] shared_tail=0x318c6d4
- context_apis: []
- params: []
