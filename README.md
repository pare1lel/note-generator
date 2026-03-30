# Reading Notes

LLM-powered English reading notes application for language learning. Select words or sentences in articles to generate annotations, with inline badges and style analysis.

## Prerequisites

- Node.js >= 20

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:3000.

On first launch, a SQLite database (`data/notes.db`) is created automatically and seeded with 3 sample articles. No additional database setup is required.

## Production Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── articles/          # REST API routes
│   │       ├── route.ts       # GET all, POST create
│   │       └── [id]/
│   │           ├── route.ts           # PUT update
│   │           ├── annotations/       # GET/POST/DELETE
│   │           └── style-report/      # GET/PUT
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Main page layout
├── components/
│   ├── ReadingEditor.tsx      # TipTap editor with annotation marks
│   ├── AnnotationCards.tsx    # Word/Sentence/StyleReport cards
│   └── AnnotationPopup.tsx   # Full-screen annotation popup
├── extensions/
│   └── annotation-mark.ts    # Custom TipTap mark + badge decorations
└── lib/
    ├── db.ts                  # SQLite init, schema, CRUD
    ├── types.ts               # TypeScript type definitions
    ├── articles.ts            # Sample articles (seed data)
    └── llm-simulator.ts      # Simulated LLM responses
```

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **TipTap** + ProseMirror (rich text editor)
- **better-sqlite3** (local SQLite storage)
