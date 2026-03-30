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
- `src/components/ReadingEditor.tsx` — TipTap editor with annotation marks, badge decorations, popup; uses `forwardRef` exposing `ReadingEditorRef.getContent()`
- `src/components/AnnotationCards.tsx` — WordAnnotationCard, SentenceAnnotationCard, StyleReportCard (all exported)
- `src/components/AnnotationPopup.tsx` — Full-screen modal with blurred backdrop for annotation display
- `src/extensions/annotation-mark.ts` — Custom TipTap Mark + ProseMirror plugin for badge decorations
- `src/lib/db.ts` — SQLite database init, schema, seed, CRUD functions (articles, annotations, style_reports)
- `src/lib/llm-simulator.ts` — Simulated LLM responses (demo mode)
- `src/lib/articles.ts` — 3 sample English articles (used as seed data)
- `src/lib/types.ts` — TypeScript type definitions (including MarkPosition)
- `src/app/api/articles/route.ts` — GET all articles, POST create article
- `src/app/api/articles/[id]/route.ts` — PUT update article
- `src/app/api/articles/[id]/annotations/route.ts` — GET/POST/DELETE annotations
- `src/app/api/articles/[id]/style-report/route.ts` — GET/PUT style report

## Architecture & Interaction Flow

### Persistent Storage (SQLite)
- Database file: `data/notes.db` (gitignored)
- Tables: `articles`, `annotations`, `style_reports`
- On first run, seeds 3 sample articles from `src/lib/articles.ts`
- `next.config.js` has `serverExternalPackages: ["better-sqlite3"]`
- Annotations stored with mark positions (`mark_from`, `mark_to`, `mark_number`) for editor restoration
- `updateArticle()` clears associated annotations and style_reports (content change invalidates positions)

### Annotation Flow
1. User selects text in editor -> floating button appears ("Annotate Word" / "Explain Sentence")
2. Click button -> ReadingEditor generates unique ID, records ProseMirror {from, to} positions, calls parent callback
3. Parent (page.tsx) generates annotation async via llm-simulator, stores with same ID
4. Annotation auto-saved to DB via POST API with mark positions
5. When annotation arrives in props, ReadingEditor applies TipTap mark at saved {from, to} range
6. ProseMirror plugin renders `<sup>` badge (Decoration.widget) at end of each mark range
7. Click badge -> full-screen popup shows annotation (only badge click, not text click)
8. Popup has close (X) and delete (trash) buttons; delete also removes from DB
9. On article load, savedMarks prop seeds pendingAnnotationsRef to restore marks

### Annotation Numbering
- Uses smallest unused positive integer (not simple increment)
- `getNextAnnotationNumber()` scans pending + editor marks to find used numbers
- Deleted annotation numbers are reused by new annotations

### Style Report
- Auto-loaded from DB cache when article changes; generated + saved if not cached
- Regenerate button in Style Report panel header re-generates and overwrites cache
- StyleReportCard has no dismiss button

### Article Management
- Articles loaded from DB via GET API on mount
- Article selector dropdown in header
- "+" button next to selector opens Add Article modal (title, author, content fields)
- Editor content is directly editable (`editable: true`)
- "Save" button in reading panel header saves current editor HTML to DB via PUT API
- ReadingEditor exposes `getContent()` via `forwardRef` + `useImperativeHandle`

### Key Technical Details
- **Nested annotations**: `AnnotationMark` has `excludes: ""` allowing self-nesting
- **Badge rendering**: ProseMirror `Decoration.widget` with `stopEvent: () => true`
- **Badge click**: Capture-phase `mousedown` listener with both `preventDefault()` and `stopPropagation()` to prevent cursor placement
- **Badge unselectable**: CSS `user-select: none` prevents badge numbers from being included in text selection
- **Only badge triggers popup**: Text click on annotation marks does NOT open popup, only badge click does
- **Popup**: Fixed position, full-screen with padding (`p-8`), `backdrop-blur-sm` + semi-transparent black overlay
- **Card components** accept optional `className`, `onClose`, `onDelete` props for popup context

### Layout
- Left panel (65%): TipTap editor with inline annotation badges + Save button
- Right panel (35%): Style Report with Regenerate button
- Header: app title, theme toggle (dark/light), article selector dropdown, "+" add article button

## Current Status
- Persistent storage with SQLite fully implemented
- Article CRUD (add via modal, inline edit + save) working
- Style report caching + regeneration working
- Build passes, dev server runs on http://localhost:3000

## Running Commands
```bash
export PATH="/tmp/node-v20.11.0-darwin-arm64/bin:$PATH"
npm run dev   # Start dev server
npm run build # Production build
```
