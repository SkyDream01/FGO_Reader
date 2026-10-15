# 简报: cluster `flow`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## masterNameWidth
- handler: `0x3185be0` case_entry: `0x317c688` verify: `0x3185bd8` hash: `0x110334b4` min_token: 7
- commands.json params: []
- command_params.json: handler=0x3185be0 optional_pd=[2, 4, 6] shared_tail=None
- context_apis: ["ScriptMessageLabel$$GetFontSize", "ScriptMessageCommonManager$$CreateLabel", "ScriptManager$$ModifyPlaySpeed", "ScriptManager$$ConvertCharaIndex", "ScriptFsmObjectData$$SetState", "ScriptManager$$IsNormalPlaySpeed", "ScriptManager$$EndFlashDep", "ScriptManager$$IsExistTargetSubLayerGroup", "ScriptSubLayerManager$$GetScriptSubLayer"]
- params: [{"pd": 0, "type": "string", "meaning": "替换字符串/名字键(ScriptReplaceString.GetString)", "values": null, "confidence": "medium", "evidence": [51928680, 51929040], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3185c08"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "string", "meaning": "名字文本", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 3, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3185c08"], "sources": ["automation", "params-visual"]}, {"pd": 5, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3185c08"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "string", "meaning": "翻转/朝向(H/V/F/其他)", "values": null, "confidence": "medium", "evidence": ["0x319002c"], "sources": ["automation", "params-visual"]}, {"pd": 8, "type": "string", "meaning": "画框图片名(ConvertPictureFrameImageName)", "values": null, "confidence": "high", "evidence": ["0x31919fc"], "sources": ["automation", "params-visual"]}]

## questMessageOverwrite
- handler: `0x317d710` case_entry: `0x317d6e0` verify: `0x317d704` hash: `0x698d999` min_token: None
- commands.json params: []
- command_params.json: handler=0x317d710 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$GetOverwriteText", "ScriptManager$$InitFlashCommand", "ScriptManager$$ConvertNameString", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsFastPlaySpeed", "ScriptCharaData$$ResumeCutin"]
- params: [{"pd": 0, "type": "string", "meaning": "文本键/文本", "values": "文本（与常量 'QuestMessageAdd' 拼接）", "confidence": "medium", "evidence": ["0x317d764 String.Concat('QuestMessageAdd', pd0)", 51894760], "sources": ["automation", "params-misc"]}]

## revivalBranch
- handler: `0x31853a4` case_entry: `0x317bd34` verify: `0x318539c` hash: `0x5d81bb60` min_token: 3
- commands.json params: []
- command_params.json: handler=0x31853a4 optional_pd=[2, 4, 6] shared_tail=None
- context_apis: ["ScriptManager$$IsExistTargetSubLayerGroup", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$Shake", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptCharaData$$SetCutin"]
- params: [{"pd": 0, "type": "string", "meaning": "分支值/名称", "values": "—", "confidence": "low", "evidence": ["0x31853a4 pd1==' ' 守卫", 51926648], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51926716], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## rewardSwitch
- handler: `0x318522c` case_entry: `0x317bc08` verify: `0x3185224` hash: `0x20460882` min_token: None
- commands.json params: []
- command_params.json: handler=0x318522c optional_pd=[1, 2, 4, 6] shared_tail=None
- context_apis: ["ScriptMessageCommonManager$$ResetLongPress", "ScriptManager$$ModifyPlaySpeed", "ScriptManager$$ConvertMessageWindowName", "ScriptMessageCommonManager$$ChangeMessageWindow", "ScriptManager$$IsExistTargetSubLayerGroup", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$Shake"]
- params: [{"pd": 0, "type": "string", "meaning": "开关", "values": "true/false", "confidence": "medium", "evidence": ["0x3185284 pd0=='true'", 51925752], "sources": ["automation", "params-misc"]}]
