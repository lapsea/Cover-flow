# texts/

和 `covers/` 同名的文本文件，点击封面翻转后显示。支持两种格式：

## 1. 纯文本（`.txt`）

```
covers/A Beautiful Day.jpg
texts/A Beautiful Day.txt   ← 直接显示全文，无高亮
```

## 2. 带时间戳的分段文本（`.json`），随音频高亮

```
covers/A Beautiful Day.jpg
audio/A Beautiful Day.mp3
texts/A Beautiful Day.json  ← 按 audio 播放进度逐段高亮
```

格式：每段一个对象，`start` / `end` 为相对音频开头的秒数。

```json
[
  { "start": 0,   "end": 4.2,  "text": "第一段文字……" },
  { "start": 4.2, "end": 9.5,  "text": "第二段文字……" }
]
```

若同时存在 `.txt` 和 `.json`，优先使用 `.json`（高亮模式）。
