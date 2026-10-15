# 简报: cluster `message`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## betweenHeight
- handler: `0x318472c` case_entry: `0x317b0a4` verify: `0x3184724` hash: `0x9859d490` min_token: None
- commands.json params: []
- command_params.json: handler=0x318472c optional_pd=[1, 2] shared_tail=None
- context_apis: ["ScriptMessageCommonManager$$SetBetweenLineHeight", "ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$SetFace", "ScriptManager$$ConvertNameString", "ScriptActionAdvPrefabController$$SetShow", "ScriptManager$$InitWipe", "ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed", "CommonEffectManager$$Stop", "ScriptManager$$IsWaitTalk"]
- params: [{"pd": 0, "type": "float", "meaning": "行高；'-' 表示 -1（默认）", "values": "-1 / 像素", "confidence": "high", "evidence": ["0x3184754 pd0=='-'→-1.0;0x3184788 SetBetweenLineHeight", 51922960, 51923148, 51923340], "sources": ["automation", "params-misc"]}]

## charaFaceIcon
- handler: `0x3182e04` case_entry: `0x317dedc` verify: `0x3182dfc` hash: `0x7ab7e550` min_token: 3
- commands.json params: []
- command_params.json: handler=0x3182e04 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$IsMoveAlpha", "ScriptCharaData$$SetFace", "ScriptCharaData$$SetPosition", "ScriptCharaData$$SetMaskData"]
- params: [{"pd": 0, "type": "string", "meaning": "角色槽位(A-Z/数字)", "values": null, "confidence": "high", "evidence": ["0x3182e54", 51916372], "sources": ["automation", "params-visual"]}, {"pd": 1, "type": "separator", "meaning": "分隔符 ` `(此位不是参数值)", "values": null, "confidence": "high", "evidence": ["0x3182e2c"], "sources": ["automation", "params-visual"]}, {"pd": 2, "type": "?", "meaning": "表情图标编号", "values": null, "confidence": "low", "evidence": [], "sources": ["automation", "params-visual"]}, {"pd": 4, "type": "int", "meaning": "图标 X 坐标(SetPosition(float,float))", "values": null, "confidence": "high", "evidence": ["0x3182f14"], "sources": ["automation", "params-visual"]}, {"pd": 6, "type": "int", "meaning": "图标 Y 坐标", "values": null, "confidence": "high", "evidence": ["0x3182f38"], "sources": ["automation", "params-visual"]}]

## faceTalkScreen
- handler: `0x317cd60` case_entry: `0x317cd30` verify: `0x317cd54` hash: `0xce912426` min_token: None
- commands.json params: []
- command_params.json: handler=0x317cd60 optional_pd=[] shared_tail=0x3193f00
- context_apis: []
- params: []

## fontType
- handler: `0x31795f8` case_entry: `0x31795c8` verify: `0x31795ec` hash: `0x949487b8` min_token: None
- commands.json params: []
- command_params.json: handler=0x31795f8 optional_pd=[1] shared_tail=None
- context_apis: ["ScriptManager$$ConvertFontName"]
- params: [{"pd": 0, "type": "string", "meaning": "字体名；normal=默认字体", "values": "normal / 资源名", "confidence": "high", "evidence": ["0x3179614 IsNullOrEmpty;0x3179648 pd0=='normal';0x3179674 ConvertFontName", 51877492], "sources": ["automation", "params-misc"]}]

## l
- handler: `0x318472c` case_entry: `0x317af28` verify: `0x3184724` hash: `0xe90c310b` min_token: None
- commands.json params: []
- command_params.json: handler=0x318472c optional_pd=[1, 2] shared_tail=None
- context_apis: ["ScriptMessageCommonManager$$SetBetweenLineHeight", "ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$SetFace", "ScriptManager$$ConvertNameString", "ScriptActionAdvPrefabController$$SetShow", "ScriptManager$$InitWipe", "ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed", "CommonEffectManager$$Stop", "ScriptManager$$IsWaitTalk"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51922960, 51923148, 51923340], "meaning": "角色槽位索引(把 A-Z / 数字转成槽位号)", "conv": ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptManager$$ConvertTalkEffectName"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## messageAlign
- handler: `0x3186e48` case_entry: `0x317d354` verify: `0x3186e40` hash: `0xe055dfd1` min_token: None
- commands.json params: []
- command_params.json: handler=0x3186e48 optional_pd=[2] shared_tail=None
- context_apis: ["ScriptManager$$ConvertCharaIndex", "ScriptManager$$GetFSCommandOffsetX", "ScriptCharaData$$SetPosition", "ScriptCharaData$$IsLoad", "ScriptCharaData$$Destroy", "ScriptManager$$ConvertNameString"]
- params: [{"pd": 0, "type": "int/string", "meaning": "对齐/行首参数（int 或对齐数据）", "values": "—", "confidence": "low", "evidence": ["0x3186e5c（pd.Length==1 路径）;0x318b478 Int32::Parse", 51932880], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "浮点参数", "values": "—", "confidence": "low", "evidence": ["0x318b660 Single::Parse", 51933356], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "float", "meaning": "浮点参数", "values": "—", "confidence": "low", "evidence": ["0x318b684 Single::Parse"], "sources": ["automation", "params-misc"]}]

## messageChange
- handler: `0x31852b8` case_entry: `0x317bce8` verify: `0x31852b0` hash: `0x9e17a594` min_token: 1
- commands.json params: [{"index": 0, "name": null, "type": "unknown", "consumer": "ConvertMessageWindowName", "evidence": "0x31852f8"}]
- command_params.json: handler=0x31852b8 optional_pd=[] shared_tail=None
- context_apis: ["ScriptMessageCommonManager$$ResetLongPress", "ScriptManager$$ModifyPlaySpeed", "ScriptManager$$ConvertMessageWindowName", "ScriptMessageCommonManager$$ChangeMessageWindow"]
- params: [{"pd": 0, "type": "string", "meaning": "消息窗名（ScriptUI/MessageWindow/<name>）", "values": "资源名", "confidence": "high", "evidence": ["0x31852f8", "0x31852f8 ConvertMessageWindowName", 51925752], "sources": ["automation", "params-misc"]}]

## messageShake
- handler: `0x3182074` case_entry: `0x317d364` verify: `0x318206c` hash: `0xe127297a` min_token: 7
- commands.json params: []
- command_params.json: handler=0x3182074 optional_pd=[2, 4, 6] shared_tail=None
- context_apis: ["ScriptManager$$IsFastPlaySpeed", "ScriptMessageCommonManager$$Shake", "ScriptManager$$ConvertTalkEffectName", "CommonEffectManager$$Stop", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed", "ScriptCharaData$$MoveScaleEase"]
- params: [{"pd": 0, "type": "float", "meaning": "持续时间 duration", "values": "秒", "confidence": "medium", "evidence": ["0x3182118 Single::Parse", 51913240, 51913436], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "float", "meaning": "周期 cycle", "values": "秒", "confidence": "medium", "evidence": ["0x3182190 Single::Parse"], "sources": ["automation", "params-misc"]}, {"pd": 4, "type": "float", "meaning": "X 振幅", "values": "像素", "confidence": "low", "evidence": ["0x31821b4 Single::Parse"], "sources": ["automation", "params-misc"]}, {"pd": 6, "type": "float", "meaning": "Y 振幅", "values": "像素", "confidence": "low", "evidence": ["0x3182148 Single::Parse"], "sources": ["automation", "params-misc"]}]

## messageShakeStop
- handler: `0x317e89c` case_entry: `0x317e86c` verify: `0x317e890` hash: `0x47473262` min_token: None
- commands.json params: []
- command_params.json: handler=0x317e89c optional_pd=[2, 4] shared_tail=None
- context_apis: ["ScriptMessageCommonManager$$Shake", "ScriptManager$$IsNormalPlaySpeed", "ScriptManager$$ConvertWipeName", "ScriptManager$$StartWipe"]
- params: [{"pd": 0, "type": "string", "consumer": null, "evidence": [51898812], "meaning": "划像名(拼成 Wipe/<name>)", "conv": ["ScriptManager$$ConvertWipeName"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]

## messageSpeedForcedNormal
- handler: `0x3184204` case_entry: `0x317a480` verify: `0x31841fc` hash: `0xb86e2e29` min_token: 1
- commands.json params: []
- command_params.json: handler=0x3184204 optional_pd=[1, 2, 4] shared_tail=None
- context_apis: ["ScriptManager$$ConvertTalkEffectName", "CommonEffectManager$$Stop", "ScriptManager$$ConvertCharaIndex", "ScriptCharaData$$IsMoveAlpha", "SoundManager$$changeVolumeSe", "ScriptManager$$IsFastPlaySpeed", "CommonEffectManager$$ForceStop"]
- params: [{"pd": 0, "type": "string", "meaning": "开关", "values": "on / off", "confidence": "high", "evidence": ["0x318422c pd0=='on';0x318c2e0 pd0=='off'", 51921560, 51921744, 51922148], "sources": ["automation", "params-misc"]}]

## messageStart
- handler: `0x317f98c` case_entry: `0x3179dcc` verify: `0x317f980` hash: `0xa9fb9b48` min_token: None
- commands.json params: []
- command_params.json: handler=0x317f98c optional_pd=[1] shared_tail=None
- context_apis: ["ScriptMessageCommonManager$$CalcMessageVerticalAlign", "ScriptManager$$ConvertNameString", "ScriptSubLayerManager$$GetScriptSubLayer", "ScriptSubLayer$$ShakeStop"]
- params: [{"pd": 0, "type": "string[]", "meaning": "消息垂直对齐用参数数组（整段 pd 传入，解释在消息管理侧）", "values": "—", "confidence": "low", "evidence": ["0x317f99c CalcMessageVerticalAlign(dataList)", 51903340, 51903520], "sources": ["automation", "params-misc"]}]

## page
- handler: `0x3182038` case_entry: `0x317c120` verify: `0x317c144` hash: `0x815dfa76` min_token: None
- commands.json params: []
- command_params.json: handler=0x3182038 optional_pd=[2, 4, 6] shared_tail=None
- context_apis: ["ScriptManager$$IsFastPlaySpeed", "ScriptMessageCommonManager$$Shake", "ScriptManager$$ConvertTalkEffectName", "CommonEffectManager$$Stop", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$IsNormalPlaySpeed", "ScriptCharaData$$MoveScaleEase"]
- params: [{"pd": 0, "type": "string[]", "meaning": "整段 pd（存入 waitType）", "values": "—", "confidence": "medium", "evidence": ["0x3182054 b #0x3192e70 → str x1,[x19,#0x3d8]", 51913240, 51913436], "sources": ["automation", "params-misc"]}]

## talkNameBack
- handler: `0x3184900` case_entry: `0x317b290` verify: `0x31848f8` hash: `0xd9f57ae7` min_token: 1
- commands.json params: []
- command_params.json: handler=0x3184900 optional_pd=[1, 2] shared_tail=None
- context_apis: ["ScriptManager$$InitWipe", "ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed", "CommonEffectManager$$Stop", "ScriptManager$$IsWaitTalk", "ScriptManager$$InitFade", "ScriptManager$$ConvertCharaIndex", "ScriptManager$$ConvertNameString", "ScriptManager$$ScriptCommandExecute", "ScriptManager$$IsContinueSilhouette", "ScriptManager$$GetCharaSpecialEffectSubParam"]
- params: [{"pd": 0, "type": "string", "meaning": "图片名", "values": "资源名", "confidence": "high", "evidence": ["0x318b1bc SetTalkNameBack(imageName)", 51923340, 51923924], "sources": ["automation", "params-misc"]}, {"pd": 2, "type": "string", "consumer": null, "evidence": [51923996], "meaning": "名称字符串(立绘/资源/对象名)", "conv": ["ScriptManager$$ConvertNameString"], "api_hint": null, "confidence": "low", "sources": ["automation"], "confidence_note": "边界放宽后扫描,可能混入相邻指令"}]
