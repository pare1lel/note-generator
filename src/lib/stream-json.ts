import type { ApiConfig } from "./types";

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
          }
        } catch {
          // skip parse failures
        }
      }
    }
  }

  // Final parse: try each '{' position (same robustness as non-streaming path)
  const braceIndices: number[] = [];
  for (let i = 0; i < accumulated.length; i++) {
    if (accumulated[i] === "{") braceIndices.push(i);
  }
  for (const start of braceIndices) {
    const sub = accumulated.slice(start);
    const m = sub.match(/\{[\s\S]*\}/);
    if (!m) continue;
    try {
      return JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      const sanitized = m[0].replace(/[\x00-\x1f\x7f]/g, (ch: string) => {
        if (ch === "\n") return "\\n";
        if (ch === "\r") return "\\r";
        if (ch === "\t") return "\\t";
        return "";
      });
      try {
        return JSON.parse(sanitized) as Record<string, unknown>;
      } catch {
        continue;
      }
    }
  }

  throw new Error("Could not parse JSON from streamed response");
}
