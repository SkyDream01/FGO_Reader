# 简报: cluster `cri_audio`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## cueSe
- handler: `0x3186434` case_entry: `0x317c80c` verify: `0x318642c` hash: `0xb129b224` min_token: 7
- commands.json params: [{"index": 0, "name": null, "type": "string", "consumer": "ConvertNameString", "evidence": "0x318fcbc"}, {"index": 2, "name": null, "type": "string", "consumer": "ConvertNameString", "evidence": "0x318fce4"}, {"index": 4, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x318fd08"}]
- command_params.json: handler=0x3186434 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$IsNormalPlaySpeed", "ScriptManager$$ConvertNameString"]
- params: [{"pd": 0, "type": "string", "meaning": "资源名 assetName", "values": "资源名", "confidence": "high", "evidence": ["0x3186504 ConvertNameString", "0x318fcbc", 51930372], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "string", "meaning": "对象名 objectName", "values": "对象名", "confidence": "high", "evidence": ["0x318652c ConvertNameString", "0x318fce4", 51930412], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "float", "meaning": "参数 A", "values": "—", "confidence": "low", "evidence": ["0x3186574 Single::Parse", "0x318fd08"], "sources": ["automation", "params-misc"]}, {"pd": 6, "type": "float", "meaning": "参数 B", "values": "—", "confidence": "low", "evidence": ["0x3186550 Single::Parse"], "sources": ["automation", "params-misc"]}]

## cueSeContinue
- handler: `0x317ffa4` case_entry: `0x317aa44` verify: `0x317ff98` hash: `0x4b340125` min_token: 9
- commands.json params: [{"index": 2, "name": null, "type": "string", "consumer": "ConvertNameString", "evidence": "0x3191658"}, {"index": 4, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x319167c"}, {"index": 6, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x3191608"}]
- command_params.json: handler=0x317ffa4 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$IsNormalPlaySpeed", "ScriptManager$$CheckSameIdSeContinue", "ScriptManager$$ConvertNameString", "ScriptManager$$LoadExecuteScript"]
- params: [{"pd": 0, "type": "string", "meaning": "SE 名", "values": "资源名", "confidence": "medium", "evidence": ["0x317ffa4"], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "string", "meaning": "SE 名/对象名（PlaySeContinue(name)）", "values": "—", "confidence": "medium", "evidence": ["0x3180154 PlaySeContinue(arg x1=pd2)", "0x3191658", 51905052], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "float", "meaning": "参数", "values": "—", "confidence": "low", "evidence": ["0x31800e4 Single::Parse", "0x319167c"], "sources": ["automation", "params-misc"]}, {"pd": 6, "type": "float", "meaning": "参数", "values": "—", "confidence": "low", "evidence": ["0x318007c", "0x3191608"], "sources": ["automation", "params-misc"]}, {"pd": 8, "type": "int", "meaning": "续播编号 id", "values": "整数", "confidence": "low", "evidence": ["0x318008c Int32::Parse"], "sources": ["automation", "params-misc"]}]

## cueSeContinueStop
- handler: `0x31838c8` case_entry: `0x3179c4c` verify: `0x31838c0` hash: `0x2b516325` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "op_Equality", "evidence": "0x3193e04"}]
- command_params.json: handler=0x31838c8 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptActionAdvPrefabController$$Release", "ScriptManager.<>c__DisplayClass808_5$$.ctor", "ScriptSubLayerManager$$GetScriptSubLayer", "ScriptActionRenderEffectController.StopFunction$$.ctor", "ScriptActionRenderEffectController$$StopGaussianBlur", "ScriptManager$$IsFastPlaySpeed", "ScriptManager$$IsJumpLine"]
- params: [{"pd": 0, "type": "string", "meaning": "SE 名", "values": "资源名", "confidence": "low", "evidence": ["0x31838c8", "0x3193e04", 51919612], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "淡出时间", "values": "秒", "confidence": "low", "evidence": ["0x31839a8"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "int", "meaning": "续播编号", "values": "整数", "confidence": "low", "evidence": ["0x3183964"], "sources": ["automation", "params-misc"]}]

## cueSeContinueVolume
- handler: `0x3188898` case_entry: `0x317e7e8` verify: `0x3188890` hash: `0xe4cc08cf` min_token: 7
- commands.json params: [{"index": 2, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x31889a0"}, {"index": 4, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x318897c"}, {"index": 6, "name": null, "type": "int", "consumer": "Parse", "evidence": "0x3188938"}]
- command_params.json: handler=0x3188898 optional_pd=[2, 3, 4, 6] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$StopMoveAlphaLoop", "ScriptManager$$SearchFlag"]
- params: [{"pd": 0, "type": "string", "meaning": "SE 名", "values": "资源名", "confidence": "low", "evidence": ["0x3188898", 51939832, 51939984], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "渐变时间", "values": "秒", "confidence": "low", "evidence": ["0x31889a0"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "float", "meaning": "音量", "values": "0.0–1.0", "confidence": "low", "evidence": ["0x318897c"], "sources": ["automation", "params-misc"]}, {"pd": 6, "type": "int", "meaning": "续播编号", "values": "整数", "confidence": "low", "evidence": ["0x3188938"], "sources": ["automation", "params-misc"]}]

## cueSeStop
- handler: `0x3188bb0` case_entry: `0x317ea6c` verify: `0x3188ba8` hash: `0x81709bec` min_token: 3
- commands.json params: [{"index": 0, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x3188c2c"}, {"index": 2, "name": null, "type": "float", "consumer": "Parse", "evidence": "0x3188c2c"}]
- command_params.json: handler=0x3188bb0 optional_pd=[2] shared_tail=0x318bd58
- context_apis: []
- params: [{"pd": 0, "type": "string", "meaning": "SE 名", "values": "资源名", "confidence": "medium", "evidence": ["0x3188bb0 头部+0x318bd5c StopSe", "0x3188c2c"], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "淡出时间", "values": "秒", "confidence": "medium", "evidence": ["0x3188c2c", "0x3188c2c Single::Parse"], "sources": ["automation", "params-misc"]}]

## cueSeVolume
- handler: `0x318440c` case_entry: `0x317aa34` verify: `0x3184404` hash: `0x4a9cd496` min_token: 5
- commands.json params: []
- command_params.json: handler=0x318440c optional_pd=[2, 4] shared_tail=None
- context_apis: ["SoundManager$$changeVolumeSe"]
- params: [{"pd": 0, "type": "string", "meaning": "SE 名", "values": "资源名", "confidence": "high", "evidence": ["0x31844e4 changeVolumeSe", 51922148], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "渐变时间 fadeTime", "values": "秒", "confidence": "medium", "evidence": ["0x31844b4→与 seVolume 同构"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "float", "meaning": "音量 volume", "values": "0.0–1.0", "confidence": "medium", "evidence": ["0x3184490"], "sources": ["automation", "params-misc"]}]

## cueVoice
- handler: `0x317cef8` case_entry: `0x317cec8` verify: `0x317ceec` hash: `0x316fbd5a` min_token: 3
- commands.json params: []
- command_params.json: handler=0x317cef8 optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptManager$$IsNormalPlaySpeed", "ScriptManager$$ConvertNameString", "CommonEffectManager$$Get", "ScriptActionAdvPrefabController$$Prepare"]
- params: [{"pd": 0, "type": "string", "meaning": "语音名", "values": "资源名", "confidence": "low", "evidence": ["0x317cef8", 51892596], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "string", "meaning": "对象名/参数", "values": "—", "confidence": "low", "evidence": ["0x317cf8c ConvertNameString"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "string/float", "meaning": "参数", "values": "—", "confidence": "low", "evidence": ["0x317cf20 pd1==' ' 守卫"], "sources": ["automation", "params-misc"]}]

## cueVoiceStop
- handler: `0x3179ed0` case_entry: `0x3179ea0` verify: `0x3179ec4` hash: `0x6b2bbb82` min_token: None
- commands.json params: []
- command_params.json: handler=0x3179ed0 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertNameString", "ScriptManager$$ConvertSpriteMaskName"]
- params: [{"pd": 0, "type": "string", "meaning": "语音名", "values": "资源名", "confidence": "low", "evidence": ["0x318e7bc ConvertNameString", 51879996], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "淡出时间", "values": "秒", "confidence": "low", "evidence": ["0x3179f58 Single::Parse"], "sources": ["automation", "params-misc"]}]

## cueVoiceVolume
- handler: `0x317b954` case_entry: `0x317b924` verify: `0x317b948` hash: `0xd1009d6c` min_token: 5
- commands.json params: []
- command_params.json: handler=0x317b954 optional_pd=[2, 4, 5] shared_tail=0x318d244
- context_apis: []
- params: [{"pd": 0, "type": "string", "meaning": "语音名", "values": "资源名", "confidence": "low", "evidence": ["0x317b954"], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "渐变时间", "values": "秒", "confidence": "low", "evidence": ["0x317b97c pd1==' ' 守卫"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "float", "meaning": "音量", "values": "0.0–1.0", "confidence": "low", "evidence": ["0x317b9a8 pd3==' ' 守卫"], "sources": ["automation", "params-misc"]}]

## keepSubBgmOff
- handler: `0x31797d0` case_entry: `0x31797a0` verify: `0x31797c4` hash: `0xd74cae15` min_token: None
- commands.json params: []
- command_params.json: handler=0x31797d0 optional_pd=[] shared_tail=None
- context_apis: ["BgmManager$$Enable_KeepSubBgm", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51878024], "meaning": "角色槽位索引(把 A-Z / 数字转成槽位号)", "conv": ["ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## keepSubBgmOn
- handler: `0x3181fd4` case_entry: `0x317d210` verify: `0x3181fcc` hash: `0x1f76ee39` min_token: None
- commands.json params: []
- command_params.json: handler=0x3181fd4 optional_pd=[2, 4, 6] shared_tail=None
- context_apis: ["BgmManager$$Enable_KeepSubBgm", "ScriptManager$$IsFastPlaySpeed", "ScriptMessageCommonManager$$Shake", "ScriptManager$$ConvertTalkEffectName", "CommonEffectManager$$Stop", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed", "ScriptCharaData$$MoveScaleEase"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51913240, 51913436], "meaning": "对话特效名(拼成 Talk/<name>)", "conv": ["ScriptManager$$ConvertTalkEffectName", "ScriptManager$$ConvertCharaIndex"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]
