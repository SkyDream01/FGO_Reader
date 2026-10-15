# 简报: cluster `endfade`

handler = ScriptCommandExecute 内代码块 VA;params/context_apis 来自 out/command_params.json。

## endFade
- handler: `0x31843b4` case_entry: `0x317a9e8` verify: `0x31843ac` hash: `0x867da2ec` min_token: 1
- commands.json params: []
- command_params.json: handler=0x31843b4 optional_pd=[1, 2, 4] shared_tail=None
- context_apis: ["SoundManager$$changeVolumeSe", "ScriptManager$$ConvertTalkEffectName", "ScriptManager$$IsFastPlaySpeed", "CommonEffectManager$$ForceStop", "SoundManager$$isPlayJingle", "ScriptMessageCommonManager$$SetBetweenLineHeight"]
- params: [{"pd": 0, "type": "string", "meaning": "'clear'=清除淡出状态(与 'clear' 比较;否则按其他值处理)", "values": null, "confidence": "high", "evidence": ["0x31843e0", 51922148, 51922216, 51922684], "sources": ["automation", "params-visual"]}]
