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
- @libsql/client (Turso / LibSQL — cloud SQLite)
- bcryptjs + jose (auth)

## Key Files
- `src/app/page.tsx` — Main page, left=editor (65%), right=Style Report (35%), auth gate
- `src/components/ReadingEditor.tsx` — TipTap editor with annotation marks, badge decorations, popup; uses `forwardRef` exposing `ReadingEditorRef.getContent()` and `dismissAnnotation(id)`
- `src/components/AnnotationCards.tsx` — WordAnnotationCard, SentenceAnnotationCard, StyleReportCard (all exported); `StreamText` helper for streaming cursor UI
- `src/components/AnnotationPopup.tsx` — Full-screen modal with blurred backdrop for annotation display, supports `isStreaming` prop
- `src/components/Settings.tsx` — Settings modal for Anthropic API configs (localStorage persistence)
- `src/components/ApiErrorDialog.tsx` — API error dialog with "Try Next API" / "Use Demo Fallback" options
- `src/components/AuthPage.tsx` — Full-screen login/register page (username+password)
- `src/extensions/annotation-mark.ts` — Custom TipTap Mark + ProseMirror plugin for badge decorations
- `src/lib/db.ts` — Turso/LibSQL database init, schema, seed, async CRUD functions (users, articles, annotations, style_reports)
- `src/lib/auth.ts` — JWT (jose) sign/verify, session cookie helpers, `getSessionFromRequest()`
- `src/lib/llm-simulator.ts` — Simulated LLM responses (demo mode, sets `model: "demo"`)
- `src/lib/stream-json.ts` — Partial JSON parser (`tryParsePartialJson`), `repairJson()`, SSE streaming consumer (`streamGenerate` — calls Anthropic API directly from browser)
- `src/lib/prompts.ts` — Prompt templates for word/sentence/style generation (`buildPrompt()`)
- `src/lib/articles.ts` — 3 sample English articles (used as seed data)
- `src/lib/types.ts` — TypeScript type definitions (including MarkPosition, ApiConfig, User)
- `src/app/api/articles/route.ts` — GET all articles (by user), POST create article
- `src/app/api/articles/[id]/route.ts` — PUT update article, DELETE article (with ownership check)
- `src/app/api/articles/[id]/annotations/route.ts` — GET/POST/DELETE annotations (with ownership check)
- `src/app/api/articles/[id]/style-report/route.ts` — GET/PUT style report (with ownership check)
- `src/app/api/auth/register/route.ts` — POST register (bcrypt hash, seeds "The Last Leaf")
- `src/app/api/auth/login/route.ts` — POST login (bcrypt compare, JWT cookie)
- `src/app/api/auth/logout/route.ts` — POST logout (clear cookie)
- `src/app/api/auth/me/route.ts` — GET current user from JWT
- `start.sh` — Local dev startup script (gitignored, sets PATH + env vars + `npm run dev`)

## Architecture & Interaction Flow

### Multi-User Auth System
- `users` table: id (INTEGER PK AUTOINCREMENT), username (UNIQUE), password_hash, created_at
- `articles` table has `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- Annotations and style_reports cascade via article_id FK (implicitly per-user)
- Auth: bcryptjs password hashing, jose JWT in httpOnly cookie (`session`), 7-day expiry
- `getSessionFromRequest(req)` extracts userId/username from cookie JWT
- All API routes check auth; article routes also verify ownership via `getArticleOwner(articleId)`
- `createUser()` in db.ts seeds only "The Last Leaf" by O. Henry for new users (article id = `last-leaf-${userId}`)
- API keys stay in localStorage (per-device, not per-user)
- Auth flow in page.tsx: `user` state is `undefined` (loading) → `null` (show AuthPage) → `{username}` (show app)
- Header shows username + logout button

### Persistent Storage (Turso / LibSQL)
- Production: Turso cloud database (`libsql://note-generator-pare1lel.aws-ap-northeast-1.turso.io`)
- Local dev: can use `file:data/notes.db` (embedded SQLite) or remote Turso
- Environment variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- All db functions are async (using `@libsql/client`)
- `db()` helper returns initialized client; uses `initPromise` to ensure schema creation runs only once
- Tables: `users`, `articles` (with user_id), `annotations`, `style_reports`
- On first run, DB is created with empty tables (no global seed — seeding is per-user on registration)
- Annotations stored with mark positions (`mark_from`, `mark_to`, `mark_number`) for editor restoration
- `updateArticle()` uses `batch()` to clear associated annotations and style_reports atomically
- `deleteArticle()` uses `ON DELETE CASCADE` to remove annotations + style_reports

### Anthropic API Integration (Direct Browser Call, Streaming)
- Settings modal (gear icon in header) manages multiple API configs stored in localStorage
- Each config: `baseUrl` (default `https://platform-api.xaminim.com`), `modelName`, `apiKey`
- `ApiConfig` type defined in `src/lib/types.ts`
- **API key never leaves the browser** — `streamGenerate()` calls the Anthropic API directly from the browser (no server proxy)
- `src/lib/prompts.ts` has `buildPrompt(type, params)` that constructs the LLM prompt client-side
- `streamGenerate()` fetches `${baseUrl}/v1/messages` with `stream: true`, parses Anthropic SSE `content_block_delta` events directly
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`, `X-From: note-generator`
- No server-side `/api/generate` route — removed to prevent API key leakage

### Streaming Pipeline
- `src/lib/stream-json.ts` contains:
  - `repairJson(text)`: Repairs common LLM JSON issues — escapes literal newlines/tabs, uses look-ahead to detect and escape unescaped content quotes vs structural quotes (e.g. Chinese text with ASCII `"` inside JSON string values)
  - `tryParsePartialJson(text)`: Finds first `{`, tracks open strings/brackets, closes them, tries `JSON.parse`
  - `streamGenerate(config, type, params, onUpdate)`: Calls Anthropic API directly from browser, accumulates text from `content_block_delta` SSE events, calls `onUpdate(partialResult)` on each chunk after partial JSON parsing, returns final parsed result
- Client-side flow:
  1. Trigger annotation → create placeholder with empty fields → add to state → open popup immediately
  2. Start `streamGenerate()` → `onUpdate` callback merges partial data into annotation state
  3. UI updates in real-time via `StreamText` component (shows blinking cursor `◊` when streaming)
  4. On complete: remove from `streamingIds`, save to DB
  5. On error: remove placeholder, dismiss annotation mark, show error dialog
- Demo fallback remains non-streaming (llm-simulator returns full objects)
- Final parse error includes detailed console.error with accumulated text preview, type, length, parse errors per brace position

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
- Articles loaded from DB via GET API after auth confirmed
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
- Header: app title, theme toggle (dark/light), article selector dropdown, "+" add article button, gear settings button, username display, logout button

## Current Status
- All features implemented and working
- Multi-user auth system (username+password, JWT cookie, per-user data isolation)
- Migrated from better-sqlite3 to @libsql/client (Turso) for Vercel deployment
- API key stays browser-side only (direct Anthropic API call, no server proxy)
- `repairJson()` handles LLM JSON with unescaped content quotes (look-ahead heuristic)
- Build passes, dev server runs on http://localhost:3000
- Ready for Vercel deployment

## Deployment (Vercel)
- Vercel environment variables needed:
  - `TURSO_DATABASE_URL` — Turso cloud database URL (`libsql://...`)
  - `TURSO_AUTH_TOKEN` — Turso auth token
  - `JWT_SECRET` — strong random string (fallback `"dev-secret-change-in-production"` is insecure)
- CORS: `platform-api.xaminim.com` must allow the Vercel domain for browser-direct API calls

## Running Commands
```bash
./start.sh            # Local dev (sets PATH + env vars + npm run dev)
npm run build         # Production build
```

## Notes
- `start.sh` is gitignored — contains env vars (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET)
- `/tmp/node-v20.11.0-darwin-arm64` may be cleaned by OS; re-download if npm breaks:
  `curl -sL https://nodejs.org/dist/v20.11.0/node-v20.11.0-darwin-arm64.tar.xz | tar -xJ -C /tmp/`
- API platform `platform-api.xaminim.com` requires `X-From: note-generator` header
