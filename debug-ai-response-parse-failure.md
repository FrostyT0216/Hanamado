# Debug Session: ai-response-parse-failure

## Status
[OPEN]

## Symptom
输入包含日语语法错误的用户消息后，AI 回复显示"AI 响应格式异常，请重试"，而非正常解析。

## Hypotheses
1. AI 返回的 JSON 中 `grammar_errors` 字段包含未转义字符（中文引号、换行等），破坏 JSON 结构。
2. AI 未按提示返回 `grammar_errors` 字段，返回结构异常。
3. AI 返回的内容根本不是 JSON（如 markdown 代码块或纯文本）。
4. `sendChatMessage` 接收到的 content 为空或截断。
5. 浏览器/构建缓存导致新代码没有生效。

## Instrumentation Plan
- 在 `services/ai.ts` 的 `sendChatMessage` 中插桩：记录原始 content、HTTP 状态、解析结果/异常。
- 在 `parseAiResponse` 中插桩：记录每个解析策略的执行结果和失败原因。

## Evidence
TBD

## Fix
TBD
