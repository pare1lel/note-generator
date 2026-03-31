# Project Memory

## Project Overview
LLM-powered English reading notes application for English language learning.

## GitHub
- Repository: https://github.com/pare1lel/note-generator
- Branch: main

## Tech Stack
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- TipTap (rich text editor) + ProseMirror plugins
- better-sqlite3 (local SQLite persistent storage)

## Key Files
- `src/app/page.tsx` — Main page, left=editor (65%), right=Style Report (35%)
- `src/components/ReadingEditor.tsx` — TipTap editor with annotation marks, badge decorations, popup; uses `forwardRef` exposing `ReadingEditorRef.getContent()` and `dismissAnnotation(id)`
- `src/components/AnnotationCards.tsx` — WordAnnotationCard, SentenceAnnotationCard, StyleReportCard (all exported); `StreamText` helper for streaming cursor UI
- `src/components/AnnotationPopup.tsx` — Full-screen modal with blurred backdrop for annotation display, supports `isStreaming` prop
- `src/components/Settings.tsx` — Settings modal for Anthropic API configs (localStorage persistence)
- `src/components/ApiErrorDialog.tsx` — API error dialog with "Try Next API" / "Use Demo Fallback" options
- `src/extensions/annotation-mark.ts` — Custom TipTap Mark + ProseMirror plugin for badge decorations
- `src/lib/db.ts` — SQLite database init, schema, seed, CRUD functions (articles, annotations, style_reports)
- `src/lib/llm-simulator.ts` — Simulated LLM responses (demo mode, sets `model: "demo"`)
- `src/lib/stream-json.ts` — Partial JSON parser (`tryParsePartialJson`) + SSE streaming consumer (`streamGenerate`)
- `src/lib/articles.ts` — 3 sample English articles (used as seed data)
- `src/lib/types.ts` — TypeScript type definitions (including MarkPosition, ApiConfig)
- `src/app/api/articles/route.ts` — GET all articles, POST create article
- `src/app/api/articles/[id]/route.ts` — PUT update article, DELETE article (cascade)
- `src/app/api/articles/[id]/annotations/route.ts` — GET/POST/DELETE annotations
- `src/app/api/articles/[id]/style-report/route.ts` — GET/PUT style report
- `src/app/api/generate/route.ts` — POST proxy to Anthropic API with SSE streaming (word/sentence/style generation)

## Architecture & Interaction Flow

### Persistent Storage (SQLite)
- Database file: `data/notes.db` (gitignored)
- Tables: `articles`, `annotations`, `style_reports`
- On first run, seeds 3 sample articles from `src/lib/articles.ts`
- `next.config.js` has `serverExternalPackages: ["better-sqlite3"]`
- Annotations stored with mark positions (`mark_from`, `mark_to`, `mark_number`) for editor restoration
- `updateArticle()` clears associated annotations and style_reports (content change invalidates positions)
- `deleteArticle()` uses `ON DELETE CASCADE` to remove annotations + style_reports

### Anthropic API Integration (Streaming)
- Settings modal (gear icon in header) manages multiple API configs stored in localStorage
- Each config: `baseUrl` (default `https://platform-api.xaminim.com`), `modelName`, `apiKey`
- `ApiConfig` type defined in `src/lib/types.ts`
- API proxy route `/api/generate` sends `stream: true` to Anthropic API, proxies SSE events:
  - Parses Anthropic SSE `content_block_delta` events to extract `delta.text`
  - Forwards text deltas as `data: {"t":"chunk"}\n\n`
  - Sends `data: [DONE]\n\n` when complete
  - Returns `new Response(readableStream, { headers: 'text/event-stream' })`
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `X-From: note-generator`
- 300s timeout via AbortController

### Streaming Pipeline
- `src/lib/stream-json.ts` contains:
  - `tryParsePartialJson(text)`: Finds first `{`, tracks open strings/brackets, closes them, tries `JSON.parse`
  - `streamGenerate(config, type, params, onUpdate)`: Fetches `/api/generate` as SSE, accumulates text chunks, calls `onUpdate(partialResult)` on each chunk after partial JSON parsing, returns final parsed result
- Client-side flow:
  1. Trigger annotation → create placeholder with empty fields → add to state → open popup immediately
  2. Start `streamGenerate()` → `onUpdate` callback merges partial data into annotation state
  3. UI updates in real-time via `StreamText` component (shows blinking cursor `◊` when streaming)
  4. On complete: remove from `streamingIds`, save to DB
  5. On error: remove placeholder, dismiss annotation mark, show error dialog
- Demo fallback remains non-streaming (llm-simulator returns full objects)

### Streaming UI Components
- `StreamText` in `AnnotationCards.tsx`: blinking cursor `◊` when streaming + field empty, appended cursor when streaming + field has content
- Delete button disabled during streaming
- Model pill shows "streaming..." with `animate-pulse` during streaming
- CSS: `cursor-blink` keyframe + `.streaming-cursor::after` in `globals.css`

### Streaming State Management (page.tsx)
- `streamingIds: Set<string>` — tracks which annotations are currently streaming
- `autoOpenAnnotationId` — triggers ReadingEditor to auto-open popup for newly created annotation
- `isStreamingStyle` — tracks whether style report is streaming
- Merge helpers: `mergeWordPartial`, `mergeSentencePartial`, `mergeStylePartial` — update annotation state with partial JSON data
- `addStreamingId` / `removeStreamingId` — state update helpers for Set operations

### ReadingEditor Streaming Support
- `autoOpenAnnotationId?: string | null` prop — auto-opens popup via `useEffect`
- `streamingIds?: Set<string>` prop — passed to AnnotationPopup for streaming indicator
- `dismissAnnotation(id)` exposed on ref — removes mark + closes popup (used for error cleanup)

### Generation Flow
1. If API configs exist, try first config (streaming)
2. On success: use streamed API result, set `model: config.modelName`
3. On failure: show ApiErrorDialog with error message
4. User clicks "Try Next API" -> try next config in list
5. User clicks "Use Demo Fallback" -> fall back to `llm-simulator` (sets `model: "demo"`)
6. If no configs: use demo directly

### API retry flow
- `apiRetryState` in `page.tsx` manages the retry flow state machine
- `handleApiRetryNext` also uses `streamGenerate` for consistency

### Annotation Types & Model Tracking
- `WordAnnotation`, `SentenceAnnotation`, `StyleReport` all have `model?: string` field
- Model name displayed as a pill/tag in the footer of each annotation card
- Demo-generated annotations show "demo", API-generated show the model name

### Sentence Annotation Details
- `SentenceAnnotation` has `sentenceZh?: string` for selected sentence translation
- `contextBeforeZh?: string[]` and `contextAfterZh?: string[]` for context translations
- API prompt requests Chinese translations for selected sentence + context
- Card displays Chinese translations in CONTEXT section below corresponding English text
- Demo mode does not provide these translations (fields are undefined, card skips display)

### Annotation Flow
1. User selects text in editor -> floating button appears ("Annotate Word" / "Explain Sentence")
2. Click button -> ReadingEditor generates unique ID, records ProseMirror {from, to} positions, calls parent callback
3. Parent (page.tsx) creates placeholder annotation with empty fields, opens popup immediately
4. Streams generation via `streamGenerate()`, updating annotation in real-time
5. Annotation auto-saved to DB via POST API with mark positions when streaming completes
6. When annotation arrives in props, ReadingEditor applies TipTap mark at saved {from, to} range
7. ProseMirror plugin renders `<sup>` badge (Decoration.widget) at end of each mark range
8. Click badge -> full-screen popup shows annotation (only badge click, not text click)
9. Popup has close (X) and delete (trash) buttons; delete also removes from DB
10. On article load, savedMarks prop seeds pendingAnnotationsRef to restore marks

### Annotation Numbering
- Uses smallest unused positive integer (not simple increment)
- `getNextAnnotationNumber()` scans pending + editor marks to find used numbers
- Deleted annotation numbers are reused by new annotations

### Style Report
- Auto-loaded from DB cache when article changes; generated + saved if not cached
- Regenerate button in Style Report panel header re-generates and overwrites cache
- StyleReportCard has no dismiss button, displays model name pill if available
- Streaming: placeholder StyleReport with empty analysis fields created immediately, updated via streaming

### Article Management
- Articles loaded from DB via GET API on mount
- Article selector dropdown in header
- "+" button next to selector opens Add Article modal (title, author, content fields)
- Delete button (red, next to Save) deletes current article with confirmation dialog
- Deletion cascades to annotations + style_reports, then switches to another article
- Editor content is directly editable (`editable: true`)
- "Save" button in reading panel header saves current editor HTML to DB via PUT API
- ReadingEditor exposes `getContent()` via `forwardRef` + `useImperativeHandle`

### Key Technical Details
- **Badge text excluded from context**: `getParagraphText` clones paragraph, removes `.annotation-badge` elements before getting `textContent`
- **Nested annotations**: `AnnotationMark` has `excludes: ""` allowing self-nesting
- **Badge rendering**: ProseMirror `Decoration.widget` with `stopEvent: () => true`
- **Badge click**: Capture-phase `mousedown` listener with both `preventDefault()` and `stopPropagation()` to prevent cursor placement
- **Badge unselectable**: CSS `user-select: none` prevents badge numbers from being included in text selection
- **Only badge triggers popup**: Text click on annotation marks does NOT open popup, only badge click does
- **Popup**: Fixed position, full-screen with padding (`p-8`), `backdrop-blur-sm` + semi-transparent black overlay
- **Card components** accept optional `className`, `onClose`, `onDelete` props for popup context

### Layout
- Left panel (65%): TipTap editor with inline annotation badges + Save/Delete buttons
- Right panel (35%): Style Report with Regenerate button
- Header: app title, theme toggle (dark/light), article selector dropdown, "+" add article button, gear settings button

## Current Status
- Streaming annotation generation implemented (word/sentence/style)
- Persistent storage with SQLite fully implemented
- Article CRUD (add via modal, inline edit + save, delete with cascade) working
- Style report caching + regeneration working
- Anthropic API integration with multi-config, sequential retry, demo fallback working
- Model name displayed on all annotation/report cards
- Sentence annotations include Chinese translations in CONTEXT section when API-generated
- Build passes, dev server runs on http://localhost:3000

## Running Commands
```bash
export PATH="/tmp/node-v20.11.0-darwin-arm64/bin:$PATH"
npm run dev   # Start dev server
npm run build # Production build
```

## Notes
- `/tmp/node-v20.11.0-darwin-arm64` may be cleaned by OS; re-download if npm breaks:
  `curl -sL https://nodejs.org/dist/v20.11.0/node-v20.11.0-darwin-arm64.tar.xz | tar -xJ -C /tmp/`
- API platform `platform-api.xaminim.com` requires `X-From` header
