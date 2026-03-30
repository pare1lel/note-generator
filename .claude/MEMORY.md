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

## Key Files
- `src/app/page.tsx` — Main page, left=editor (65%), right=Style Report (35%)
- `src/components/ReadingEditor.tsx` — TipTap editor with annotation marks, badge decorations, popup
- `src/components/AnnotationCards.tsx` — WordAnnotationCard, SentenceAnnotationCard, StyleReportCard (all exported)
- `src/components/AnnotationPopup.tsx` — Full-screen modal with blurred backdrop for annotation display
- `src/extensions/annotation-mark.ts` — Custom TipTap Mark + ProseMirror plugin for badge decorations
- `src/lib/llm-simulator.ts` — Simulated LLM responses (demo mode)
- `src/lib/articles.ts` — 3 sample English articles
- `src/lib/types.ts` — TypeScript type definitions

## Architecture & Interaction Flow

### Annotation Flow
1. User selects text in editor → floating button appears ("Annotate Word" / "Explain Sentence")
2. Click button → ReadingEditor generates unique ID, records ProseMirror {from, to} positions, calls parent callback
3. Parent (page.tsx) generates annotation async via llm-simulator, stores with same ID
4. When annotation arrives in props, ReadingEditor applies TipTap mark at saved {from, to} range
5. ProseMirror plugin renders `<sup>` badge (Decoration.widget) at end of each mark range
6. Click badge or highlighted text → full-screen popup shows annotation (innermost mark preferred for nested)
7. Popup has close (X) and delete (trash) buttons

### Style Report
- Auto-generated via `useEffect` when article changes (no manual button)
- Displayed permanently in the right panel
- StyleReportCard has no dismiss button

### Key Technical Details
- **Nested annotations**: `AnnotationMark` has `excludes: ""` allowing self-nesting
- **Badge rendering**: ProseMirror `Decoration.widget` with `stopEvent: () => true` (prevents ProseMirror event interception)
- **Click on annotation mark**: Capture-phase `mousedown` listener on editor wrapper calls `stopPropagation()` to prevent ProseMirror cursor placement
- **Popup**: Fixed position, full-screen with padding (`p-8`), `backdrop-blur-sm` + semi-transparent black overlay
- **Card components** accept optional `className`, `onClose`, `onDelete` props for popup context

### Layout
- Left panel (65%): TipTap editor with inline annotation badges
- Right panel (35%): Style Report only (auto-generated)
- Header: app title, theme toggle (dark/light), article selector dropdown

## Current Status
- MVP with redesigned interaction complete
- Build passes, dev server runs on http://localhost:3000

## Running Commands
```bash
export PATH="/tmp/node-v20.11.0-darwin-arm64/bin:$PATH"
npm run dev   # Start dev server
npm run build # Production build
```
