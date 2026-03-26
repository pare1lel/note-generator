"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import { useCallback, useEffect, useRef, useState } from "react";

interface ReadingEditorProps {
  content: string;
  onWordSelect: (word: string, paragraph: string) => void;
  onSentenceSelect: (sentence: string, contextBefore: string[], contextAfter: string[]) => void;
  selectedWords: Set<string>;
  selectedSentences: Set<string>;
}

export default function ReadingEditor({
  content,
  onWordSelect,
  onSentenceSelect,
  selectedWords,
  selectedSentences,
}: ReadingEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastClickTime = useRef<number>(0);
  const lastClickWord = useRef<string>("");
  const isDragging = useRef<boolean>(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const [showHighlight, setShowHighlight] = useState(false);
  const [highlightPos, setHighlightPos] = useState({ x: 0, y: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      TextStyle,
    ],
    content: content,
    editable: true,
    immediatelyRender: false,
  });

  // Update editor content when article changes
  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  // Handle double-click for word selection
  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.includes(" ")) return;

      // Get the paragraph containing this word
      const range = selection.getRangeAt(0);
      let element = range.commonAncestorContainer;
      if (element.nodeType === Node.TEXT_NODE) {
        element = element.parentElement!;
      }

      // Find the paragraph element
      let paragraph = (element as Element).closest("p");
      if (!paragraph) {
        // Try to find any block element
        paragraph = (element as Element).closest("div");
      }

      const paragraphText = paragraph?.textContent || "";

      // Check for double-click on the same word (triple-click prevention)
      const now = Date.now();
      if (
        now - lastClickTime.current < 500 &&
        lastClickWord.current === selectedText
      ) {
        return;
      }

      lastClickTime.current = now;
      lastClickWord.current = selectedText;

      // Highlight the selected word briefly
      if (editor) {
        const { from, to } = editor.state.selection;
        editor.commands.setTextSelection({ from, to });
      }

      setShowHighlight(true);
      setHighlightPos({ x: e.clientX, y: e.clientY });

      setTimeout(() => {
        setShowHighlight(false);
      }, 300);

      onWordSelect(selectedText, paragraphText);
      selection.removeAllRanges();
    },
    [onWordSelect, editor]
  );

  // Handle mouse down for drag selection start
  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Only start tracking for left click
    if (e.button !== 0) return;
    isDragging.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Handle mouse move for drag detection
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStartPos.current) return;

    const dx = Math.abs(e.clientX - dragStartPos.current.x);
    const dy = Math.abs(e.clientY - dragStartPos.current.y);

    // If moved more than 5px, consider it a drag
    if (dx > 5 || dy > 5) {
      isDragging.current = true;
    }
  }, []);

  // Handle mouse up for sentence selection
  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      // Skip if this was a double-click (word selection)
      const timeSinceLastClick = Date.now() - lastClickTime.current;
      if (timeSinceLastClick < 300) {
        dragStartPos.current = null;
        return;
      }

      // Only process if it was a drag selection (not a regular click)
      if (!isDragging.current) {
        dragStartPos.current = null;
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        dragStartPos.current = null;
        isDragging.current = false;
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText) {
        dragStartPos.current = null;
        isDragging.current = false;
        return;
      }

      // Get the paragraph context
      const range = selection.getRangeAt(0);
      let element = range.commonAncestorContainer;
      if (element.nodeType === Node.TEXT_NODE) {
        element = element.parentElement!;
      }

      const paragraph = (element as Element).closest("p") || (element as Element).closest("div");
      const paragraphText = paragraph?.textContent || "";

      // Split paragraph into sentences for context
      const sentences = paragraphText
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Find the selected sentence's position
      let selectedSentence = selectedText;
      let selectedIndex = -1;

      // Try to find the selected text in the sentences
      for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].includes(selectedText) || selectedText.includes(sentences[i])) {
          selectedIndex = i;
          selectedSentence = sentences[i];
          break;
        }
      }

      if (selectedIndex === -1) {
        // Fallback: treat selected text as a sentence
        selectedIndex = Math.floor(
          sentences.length / 2
        );
      }

      // Get context sentences (2 before and 2 after)
      const contextBefore = sentences.slice(
        Math.max(0, selectedIndex - 2),
        selectedIndex
      );
      const contextAfter = sentences.slice(
        selectedIndex + 1,
        Math.min(sentences.length, selectedIndex + 3)
      );

      if (selectedText.length > 10) {
        onSentenceSelect(selectedSentence, contextBefore, contextAfter);
      }

      selection.removeAllRanges();
      dragStartPos.current = null;
      isDragging.current = false;
    },
    [onSentenceSelect]
  );

  // Attach event listeners
  useEffect(() => {
    const editorEl = editorRef.current;
    if (!editorEl) return;

    editorEl.addEventListener("dblclick", handleDoubleClick);
    editorEl.addEventListener("mousedown", handleMouseDown);
    editorEl.addEventListener("mousemove", handleMouseMove);
    editorEl.addEventListener("mouseup", handleMouseUp);

    return () => {
      editorEl.removeEventListener("dblclick", handleDoubleClick);
      editorEl.removeEventListener("mousedown", handleMouseDown);
      editorEl.removeEventListener("mousemove", handleMouseMove);
      editorEl.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleDoubleClick, handleMouseDown, handleMouseMove, handleMouseUp]);

  return (
    <div className="relative h-full" ref={editorRef}>
      <div className="tiptap-wrapper h-full overflow-auto rounded-lg border border-border bg-surface p-6">
        <EditorContent
          editor={editor}
          className="prose prose-invert max-w-none focus:outline-none"
        />
      </div>

      {/* Visual feedback for word selection */}
      {showHighlight && (
        <div
          className="pointer-events-none fixed z-50 animate-pulse rounded-full bg-accent-gold/30 px-3 py-1 text-sm"
          style={{ left: highlightPos.x, top: highlightPos.y + 20 }}
        >
          Word selected
        </div>
      )}
    </div>
  );
}
