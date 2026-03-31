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

export function buildPrompt(
  type: "word" | "sentence" | "style",
  params: Record<string, unknown>
): string {
  if (type === "word") {
    return WORD_PROMPT(params.word as string, params.paragraph as string);
  } else if (type === "sentence") {
    return SENTENCE_PROMPT(
      params.sentence as string,
      (params.contextBefore as string[]) || [],
      (params.contextAfter as string[]) || []
    );
  } else {
    return STYLE_PROMPT(params.title as string, params.content as string);
  }
}
