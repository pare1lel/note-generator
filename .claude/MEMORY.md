# Project Memory

## Project Overview
LLM-powered English reading notes application for English language learning.

## GitHub
- Repository: https://github.com/pare1lel/note-generator
- Branch: main
- Auto-commit hook enabled (Write/Edit operations auto-commit)

## Tech Stack
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- TipTap (rich text editor)

## Key Files
- `src/app/page.tsx` — Main page with annotation logic
- `src/components/ReadingEditor.tsx` — TipTap editor with word/sentence selection
- `src/components/AnnotationCards.tsx` — Word, Sentence, Style annotation cards
- `src/lib/llm-simulator.ts` — Simulated LLM responses (demo mode)
- `src/lib/articles.ts` — 3 sample English articles
- `src/lib/types.ts` — TypeScript type definitions

## Features
1. **Word Annotation** (double-click): Literal + contextual meaning, bilingual
2. **Sentence Annotation** (drag select): "In your own words" explanation, bilingual, with context window
3. **Style Report** (button): Full text analysis (diction, sentence structure, figure of speech, rhetoric, tone), 200-300 words, bilingual

## Current Status
- MVP complete, build passes
- Dev server runs on http://localhost:3000

## Running Commands
```bash
export PATH="/tmp/node-v20.11.0-darwin-arm64/bin:$PATH"
npm run dev   # Start dev server
npm run build # Production build
```
