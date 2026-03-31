import type { ApiConfig } from "./types";

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
  type: "word" | "sentence" | "style",
  params: Record<string, unknown>,
  onUpdate: (partial: Record<string, unknown>) => void
): Promise<Record<string, unknown>> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: config.baseUrl,
      model: config.modelName,
      apiKey: config.apiKey,
      type,
      params,
    }),
  });

  if (!res.ok) {
    // Non-streaming error response (JSON)
    const data = await res.json();
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    // Fallback: non-streaming JSON response (shouldn't happen, but handle gracefully)
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let buffer = "";
  let chunkCount = 0;

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
          if (evt.error) throw new Error(evt.error);
          if (evt.t) {
            accumulated += evt.t;
            chunkCount++;
            const partial = tryParsePartialJson(accumulated);
            if (partial) onUpdate(partial);
          }
        } catch (e) {
          if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
            // Re-throw real errors (not partial parse failures)
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
          if (evt.error) throw new Error(evt.error);
          if (evt.t) {
            accumulated += evt.t;
            chunkCount++;
          }
        } catch {
          // skip parse failures
        }
      }
    }
  }

  if (accumulated.length === 0) {
    throw new Error(`Stream completed with no content (type=${type}, chunks=${chunkCount}). The API may have returned an empty response.`);
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
    `Brace positions tried: ${braceIndices.length}`,
    parseErrors.length > 0 ? `Parse errors:\n  ${parseErrors.join("\n  ")}` : "No '{' found in response",
    `Accumulated text:\n${preview}`,
  ].join("\n");
  console.error(details);
  throw new Error(`Could not parse JSON from streamed response (type=${type}, len=${accumulated.length}). Check server logs for details.`);
}
