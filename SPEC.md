# English Reading Notes - LLM-Powered Annotation Tool

## 1. Project Overview

- **Project Name**: English Reading Notes
- **Type**: Interactive web application (frontend demo)
- **Core Functionality**: An LLM-powered note-taking tool for English reading classes that generates bilingual (Chinese/English) annotations at word, sentence, and text levels.
- **Target Users**: English language learners studying reading comprehension

## 2. Technical Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Rich Text Editor**: TipTap (with extensions for text selection)
- **Styling**: Tailwind CSS
- **State Management**: React useState/useContext
- **LLM Integration**: OpenAI GPT-4 API (simulated in demo)

## 3. UI/UX Specification

### 3.1 Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Header: App Title + Article Selector                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────┐  ┌──────────────────┐ │
│  │                             │  │   Annotation     │ │
│  │   Reading Panel            │  │   Panel          │ │
│  │   (Rich Text Editor)        │  │                  │ │
│  │                             │  │   - Word Card    │ │
│  │   - Article content         │  │   - Sentence Card│ │
│  │   - Interactive selection   │  │   - Style Report │ │
│  │                             │  │                  │ │
│  └─────────────────────────────┘  └──────────────────┘ │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Toolbar: [Generate Style Report] [Clear Annotations]  │
└─────────────────────────────────────────────────────────┘
```

- **Page**: Single-page layout, responsive (min-width 768px for desktop)
- **Split ratio**: 60% reading panel / 40% annotation panel

### 3.2 Visual Design

#### Color Palette
- **Background**: `#0f0f0f` (near black)
- **Surface**: `#1a1a1a` (dark card)
- **Surface Light**: `#262626` (hover states)
- **Border**: `#333333`
- **Primary**: `#e5e5e5` (text)
- **Secondary**: `#a3a3a3` (muted text)
- **Accent Gold**: `#d4a574` (word annotations)
- **Accent Teal**: `#5eead4` (sentence annotations)
- **Accent Rose**: `#f472b6` (style report)
- **Highlight Yellow**: `rgba(250, 204, 21, 0.3)`

#### Typography
- **Font Family**: `"Crimson Pro"` for article text (serif, literary feel), `"Inter"` for UI elements
- **Heading**: 24px, font-weight 600
- **Body (Article)**: 18px, line-height 1.8
- **UI Text**: 14px
- **Annotation Title**: 16px, font-weight 600
- **Annotation Body**: 14px, line-height 1.6

#### Spacing System
- **Base unit**: 4px
- **Card padding**: 24px
- **Gap between sections**: 16px
- **Component margin**: 12px

#### Visual Effects
- **Card shadow**: `0 4px 20px rgba(0, 0, 0, 0.3)`
- **Hover transition**: 200ms ease
- **Selection highlight**: yellow with 30% opacity
- **Annotation cards**: left border accent (4px)

### 3.3 Components

#### Header
- App title "Reading Notes" with book icon
- Dropdown to select pre-loaded sample articles

#### Reading Panel (TipTap Editor)
- Read-only mode for article display
- Custom double-click handler for word selection
- Custom drag handler for sentence selection
- Highlighted text remains visible

#### Annotation Panel
- Scrollable list of annotation cards
- Empty state: "Select text to generate annotations"

#### Word Annotation Card
- Header: Selected word + "Word Analysis" label
- Two sections:
  - **Literal Meaning**: English definition + Chinese explanation
  - **Contextual Meaning**: English explanation + Chinese explanation
- Timestamp footer

#### Sentence Annotation Card
- Header: "Sentence Explanation" label
- Shows the original sentence (italic)
- **Own Words Explanation**: English + Chinese
- Window context (2 sentences before/after, smaller font)
- Timestamp footer

#### Style Report Card
- Header: "Writing Style Analysis" + article title
- Sections:
  - **Diction**: Analysis + Chinese
  - **Sentence Structure**: Analysis + Chinese
  - **Figure of Speech**: Analysis + Chinese
  - **Rhetoric**: Analysis + Chinese
  - **Tone**: Analysis + Chinese
- Total word count badge (200-300 words target)
- Timestamp footer

#### Toolbar
- "Generate Style Report" button (accent rose color)
- "Clear All" button (secondary style)
- Loading spinner during generation

## 4. Functionality Specification

### 4.1 Core Features

#### A. Word-Level Annotation (Double-Click)
1. User double-clicks any word in the article
2. System captures:
   - The selected word
   - The paragraph containing the word (as context)
   - Position info
3. System displays word annotation card with:
   - Literal meaning (dictionary definition)
   - Contextual meaning (based on paragraph context)
4. Bilingual output (English primary, Chinese secondary)

#### B. Sentence-Level Annotation (Drag Selection)
1. User drags to select a complete sentence
2. System captures:
   - The selected sentence
   - 2 sentences before (if available)
   - 2 sentences after (if available)
   - Full paragraph context
3. System displays sentence card with "in your own words" explanation
4. Bilingual output

#### C. Full-Text Style Analysis (Button Click)
1. User clicks "Generate Style Report" button
2. System sends entire article text to LLM
3. LLM returns comprehensive style analysis:
   - Diction (word choice analysis)
   - Sentence Structure
   - Figure of Speech
   - Rhetoric
   - Tone
4. Target: 200-300 words total
5. Bilingual output

### 4.2 Sample Articles (Pre-loaded)
Three sample English articles for demo:
1. "The Art of Reading" - Academic essay about reading habits
2. "Climate Change and Its Impact" - Informational article
3. "The Last Leaf" - O. Henry short story excerpt

### 4.3 User Interactions
- **Double-click**: Select word, show word annotation
- **Mouse drag**: Select sentence, show sentence annotation
- **Button click**: Generate style report
- **Card dismiss**: X button to remove individual annotations
- **Clear all**: Remove all annotations

### 4.4 Edge Cases
- Empty selection: No action
- Selection across paragraphs: Only use first paragraph context
- Very long words: Truncate display, show full in card
- Network error: Show error toast, allow retry
- API timeout: 30 second timeout, show loading state

## 5. Demo Mode

Since this is a frontend demo, LLM calls will be simulated with:
- Realistic delays (1-3 seconds) to mimic API latency
- Pre-defined annotation templates with dynamic word/sentence insertion
- Graceful fallbacks for demonstration purposes

## 6. Acceptance Criteria

1. ✅ App loads without errors
2. ✅ TipTap editor displays sample article correctly
3. ✅ Double-clicking a word shows word annotation card
4. ✅ Drag-selecting a sentence shows sentence annotation card
5. ✅ "Generate Style Report" button produces style analysis card
6. ✅ All annotations display in bilingual format
7. ✅ Annotations can be dismissed individually
8. ✅ "Clear All" removes all annotations
9. ✅ UI matches dark theme color scheme
10. ✅ Responsive layout works on desktop (min 1024px)
