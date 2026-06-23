# texts/

和 `covers/` 同名的文本文件，点击封面翻转后显示。支持三种格式：

## 1. 纯文本（`.txt`）

```
covers/A Beautiful Day.jpg
texts/A Beautiful Day.txt   ← 直接显示全文，无高亮
```

## 2. SRT 字幕（`.srt`），随音频高亮 —— 推荐

标准字幕格式，可以用任何字幕编辑工具（Aegisub、剪映、Whisper 自动生成等）制作。

```
covers/A Beautiful Day.jpg
audio/A Beautiful Day.mp3
texts/A Beautiful Day.srt   ← 按 audio 播放进度逐段高亮
```

```srt
1
00:00:00,000 --> 00:00:04,200
第一段文字……

2
00:00:04,200 --> 00:00:09,500
第二段文字……
```

## 3. 带时间戳的 JSON（`.json`），随音频高亮

```
texts/A Beautiful Day.json
```

```json
[
  { "start": 0,   "end": 4.2,  "text": "第一段文字……" },
  { "start": 4.2, "end": 9.5,  "text": "第二段文字……" }
]
```

## 优先级

若同名文件中存在多种格式，优先使用 `.srt`，其次 `.json`，最后 `.txt`。
