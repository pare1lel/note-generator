import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

const TIMEOUT_MS = 300_000; // 300 seconds

const WORD_PROMPT = (word: string, paragraph: string) => `You are an English language learning assistant. A student is reading an English article and wants to understand the word "${word}" in this paragraph:

"${paragraph}"

Provide a JSON response with this exact structure (no markdown, no code fences, just raw JSON):
{
  "literalMeaning": {
    "english": "The standard dictionary definition of the word",
    "chinese": "标准词典定义的中文翻译"
  },
  "contextualMeaning": {
    "english": "How this word is specifically used in this paragraph, what nuance or connotation it carries here",
    "chinese": "这个词在这段文字中的具体用法、语境含义的中文解释"
  }
}`;

const SENTENCE_PROMPT = (sentence: string, contextBefore: string[], contextAfter: string[]) => `You are an English language learning assistant. A student is reading an English article and wants to understand this sentence:

"${sentence}"

${contextBefore.length > 0 ? `Context before: "${contextBefore.join(" ")}"` : ""}
${contextAfter.length > 0 ? `Context after: "${contextAfter.join(" ")}"` : ""}

Explain what this sentence means in your own words, covering its meaning, purpose in the text, and any rhetorical or stylistic techniques used. Also translate the selected sentence and the context sentences into Chinese.

Provide a JSON response with this exact structure (no markdown, no code fences, just raw JSON):
{
  "sentenceZh": "所选句子的中文翻译",
  "explanation": {
    "english": "Your explanation in English",
    "chinese": "中文解释"
  }${contextBefore.length > 0 ? `,
  "contextBeforeZh": ["context before 各句的中文翻译, 与 contextBefore 一一对应"]` : ""}${contextAfter.length > 0 ? `,
  "contextAfterZh": ["context after 各句的中文翻译, 与 contextAfter 一一对应"]` : ""}
}`;

const STYLE_PROMPT = (title: string, content: string) => `You are a literary analysis expert. Analyze the writing style of this article.

Title: "${title}"

Content:
${content}

Analyze these five aspects of the writing style. For each aspect provide both English and Chinese analysis.

Provide a JSON response with this exact structure (no markdown, no code fences, just raw JSON):
{
  "analysis": {
    "diction": { "english": "Analysis of word choice...", "chinese": "措辞分析..." },
    "sentenceStructure": { "english": "Analysis of sentence patterns...", "chinese": "句式分析..." },
    "figureOfSpeech": { "english": "Analysis of figurative language...", "chinese": "修辞手法分析..." },
    "rhetoric": { "english": "Analysis of rhetorical techniques...", "chinese": "修辞技巧分析..." },
    "tone": { "english": "Analysis of tone and mood...", "chinese": "语气分析..." }
  },
  "wordCount": ${content.split(/\s+/).length}
}`;

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { baseUrl, model, apiKey, type, params } = await req.json();

    let prompt: string;
    if (type === "word") {
      prompt = WORD_PROMPT(params.word, params.paragraph);
    } else if (type === "sentence") {
      prompt = SENTENCE_PROMPT(params.sentence, params.contextBefore || [], params.contextAfter || []);
    } else if (type === "style") {
      prompt = STYLE_PROMPT(params.title, params.content);
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const apiUrl = `${baseUrl.replace(/\/+$/, "")}/v1/messages`;
    let response: Response;

    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "X-From": "note-generator",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: true,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json({ error: "Request timed out (300s)" }, { status: 504 });
      }
      throw err;
    }

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `API error (${response.status}): ${errorBody}` },
        { status: 502 }
      );
    }

    if (!response.body) {
      return NextResponse.json({ error: "Empty response body" }, { status: 502 });
    }

    // Stream SSE: parse Anthropic SSE events and forward text deltas to client
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const upstream = response.body.getReader();

    const stream = new ReadableStream({
      async start(ctrl) {
        let buf = "";
        try {
          while (true) {
            const { done, value } = await upstream.read();
            if (done) break;

            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") continue;

              try {
                const evt = JSON.parse(payload);
                if (evt.type === "content_block_delta" && evt.delta?.text) {
                  ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ t: evt.delta.text })}\n\n`));
                } else if (evt.type === "error") {
                  ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: evt.error?.message || "Stream error" })}\n\n`));
                }
              } catch {
                // Skip unparseable lines
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream read error";
          ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        }
        // Flush remaining buffer after upstream ends
        if (buf.trim()) {
          for (const line of buf.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload);
              if (evt.type === "content_block_delta" && evt.delta?.text) {
                ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ t: evt.delta.text })}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
        ctrl.enqueue(encoder.encode("data: [DONE]\n\n"));
        ctrl.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
