import type { ApiConfig } from "./types";
import { buildPrompt } from "./prompts";

/**
 * Repair common JSON issues from LLM output:
 * - Literal newlines/tabs/CR inside string values → escaped
 * - Unescaped double-quotes inside string values → escaped (uses look-ahead
 *   to distinguish structural quotes from content quotes)
 * - Control characters → removed
 */
function repairJson(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      // Backslash followed by a literal newline → convert to \n sequence
      if (ch === "\n") { result += "n"; continue; }
      if (ch === "\r") { result += "r"; continue; }
      result += ch;
      continue;
    }

    if (ch === "\\" && inString) {
      escaped = true;
      result += ch;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
      } else {
        // Determine if this is a structural close or a content quote
        // by checking whether the next non-whitespace char is structural
        let j = i + 1;
        while (j < text.length && (text[j] === " " || text[j] === "\t" || text[j] === "\n" || text[j] === "\r")) j++;
        const next = j < text.length ? text[j] : "";
        if (next === "" || next === "," || next === "}" || next === "]" || next === ":") {
          inString = false;
          result += ch;
        } else {
          // Content quote — escape it
          result += '\\"';
        }
      }
      continue;
    }

    if (inString) {
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
      const code = ch.charCodeAt(0);
      if (code < 0x20 || code === 0x7f) continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Attempt to parse a partial JSON string by closing open strings, arrays, and objects.
 * Returns the parsed object or null if parsing fails.
 */
export function tryParsePartialJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let partial = text.slice(start);
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (const ch of partial) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") stack.push("}");
    if (ch === "[") stack.push("]");
    if (ch === "}" || ch === "]") stack.pop();
  }

  // Close open string
  if (inString) partial += '"';
  // Close open structures
  while (stack.length > 0) partial += stack.pop();

  try {
    return JSON.parse(partial);
  } catch {
    return null;
  }
}

/**
 * Stream a generation request via SSE. Calls onUpdate with partial JSON as it accumulates.
 * Returns the final parsed result.
 */
export async function streamGenerate(
  config: ApiConfig,
  type: "word" | "sentence" | "style" | "qa",
  params: Record<string, unknown>,
  onUpdate: (partial: Record<string, unknown>) => void
): Promise<Record<string, unknown>> {
  const prompt = buildPrompt(type, params);
  const apiUrl = `${config.baseUrl.replace(/\/+$/, "")}/v1/messages`;

  // 429(配额/限流)和 529(过载)是瞬时错误,自动退避重试,
  // 避免每分钟配额抖动时直接弹出切换 API 的对话框。
  const MAX_RETRIES = 3;
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "X-Sub-Module": "claude-code-internal",
      },
      body: JSON.stringify({
        model: config.modelName,
        max_tokens: 8192,
        stream: true,
        // 部分代理(如 xaminim 的 claude-code-internal)会给 sonnet 默认强开
        // extended thinking,思考链能吃掉数千 token,导致答案被 max_tokens 截断。
        // 这里显式禁用,把预算全部留给正文 JSON。
        thinking: { type: "disabled" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (res.ok) break;

    const retriable = res.status === 429 || res.status === 529;
    if (!retriable || attempt >= MAX_RETRIES) {
      const errorBody = await res.text();
      throw new Error(`API error (${res.status}): ${errorBody}`);
    }

    // 优先用 Retry-After 头(秒),否则指数退避:5s, 10s, 20s。
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 5000 * 2 ** attempt;
    onUpdate({ __retrying: true, __waitMs: waitMs, __attempt: attempt + 1, __status: res.status });
    await new Promise((r) => setTimeout(r, waitMs));
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let buffer = "";
  let chunkCount = 0;
  let stopReason = "";
  let thinkingChars = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const evt = JSON.parse(data);
          if (evt.type === "error") throw new Error(evt.error?.message || "Stream error");
          if (evt.type === "message_delta" && evt.delta?.stop_reason) {
            stopReason = evt.delta.stop_reason;
          }
          if (evt.type === "content_block_delta") {
            if (evt.delta?.text) {
              accumulated += evt.delta.text;
              chunkCount++;
              const partial = tryParsePartialJson(accumulated);
              if (partial) onUpdate(partial);
            } else if (evt.delta?.type === "thinking_delta" && evt.delta?.thinking) {
              // 代理可能强制开启 extended thinking;思考链不是答案,但会吃 max_tokens 预算
              thinkingChars += evt.delta.thinking.length;
            }
          }
        } catch (e) {
          if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
            if (data.includes('"error"')) throw e;
          }
        }
      }
    }
  }

  // Flush remaining buffer after stream ends
  if (buffer.trim()) {
    for (const part of buffer.split("\n\n")) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === "error") throw new Error(evt.error?.message || "Stream error");
          if (evt.type === "message_delta" && evt.delta?.stop_reason) {
            stopReason = evt.delta.stop_reason;
          }
          if (evt.type === "content_block_delta" && evt.delta?.text) {
            accumulated += evt.delta.text;
            chunkCount++;
          }
        } catch {
          // skip parse failures
        }
      }
    }
  }

  if (accumulated.length === 0) {
    const thinkingNote = thinkingChars > 0
      ? ` 模型只产出了思考链(${thinkingChars} 字符)却没有正文,通常是 max_tokens 被思考耗尽并触发截断(stop_reason=${stopReason || "?"})。`
      : "";
    throw new Error(`Stream completed with no content (type=${type}, chunks=${chunkCount}, stop_reason=${stopReason || "?"}).${thinkingNote}`);
  }

  // Final parse: try each '{' position
  const braceIndices: number[] = [];
  for (let i = 0; i < accumulated.length; i++) {
    if (accumulated[i] === "{") braceIndices.push(i);
  }
  const parseErrors: string[] = [];
  for (const start of braceIndices) {
    const sub = accumulated.slice(start);
    const m = sub.match(/\{[\s\S]*\}/);
    if (!m) continue;
    try {
      return JSON.parse(m[0]) as Record<string, unknown>;
    } catch (e) {
      parseErrors.push(`offset=${start}: ${e instanceof Error ? e.message : String(e)}`);
      // Escape control chars only inside JSON string values (not structural whitespace)
      try {
        return JSON.parse(repairJson(m[0])) as Record<string, unknown>;
      } catch {
        continue;
      }
    }
  }

  // Last resort: use partial JSON parser which closes open structures
  const fallback = tryParsePartialJson(accumulated) ?? tryParsePartialJson(repairJson(accumulated));
  if (fallback) return fallback;

  // Build detailed error for debugging
  const preview = accumulated.length > 500
    ? accumulated.slice(0, 250) + "\n...[truncated]...\n" + accumulated.slice(-250)
    : accumulated;
  const details = [
    `[StreamJSON] Failed to parse final response (type=${type})`,
    `Accumulated length: ${accumulated.length}`,
    `stop_reason: ${stopReason || "?"}${stopReason === "max_tokens" ? " (响应被 max_tokens 截断)" : ""}`,
    `thinking chars (ignored): ${thinkingChars}`,
    `Brace positions tried: ${braceIndices.length}`,
    parseErrors.length > 0 ? `Parse errors:\n  ${parseErrors.join("\n  ")}` : "No '{' found in response",
    `Accumulated text:\n${preview}`,
  ].join("\n");
  console.error(details);
  const truncatedHint = stopReason === "max_tokens"
    ? " 响应被 max_tokens 截断,请提高 max_tokens 或检查代理是否强制开启了 thinking。"
    : "";
  throw new Error(`Could not parse JSON from streamed response (type=${type}, len=${accumulated.length}, stop_reason=${stopReason || "?"}).${truncatedHint} Check server logs for details.`);
}
