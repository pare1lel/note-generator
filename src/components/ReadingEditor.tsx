"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

interface ReadingEditorProps {
  content: string;
  onWordSelect: (word: string, paragraph: string) => void;
  onSentenceSelect: (sentence: string, contextBefore: string[], contextAfter: string[]) => void;
  selectedWords: Set<string>;
  selectedSentences: Set<string>;
}

interface FloatingButton {
  x: number;
  y: number;
  selection: string;
  selectionType: "word" | "sentence";
  paragraphText: string;
}

export default function ReadingEditor({
  content,
  onWordSelect,
  onSentenceSelect,
}: ReadingEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [floatingButton, setFloatingButton] = useState<FloatingButton | null>(null);

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

  const getParagraphText = useCallback((node: Node): string => {
    let element = node;
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement!;
    }
    const paragraph = (element as Element).closest("p") || (element as Element).closest("div");
    return paragraph?.textContent || "";
  }, []);

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      // Small delay to let selection complete
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          setFloatingButton(null);
          return;
        }

        const selectedText = selection.toString().trim();
        if (!selectedText) {
          setFloatingButton(null);
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Determine if word or sentence
        const isWord = !selectedText.includes(" ") && selectedText.split(/\s+/).length === 1;
        const paragraphText = getParagraphText(range.commonAncestorContainer);

        setFloatingButton({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
          selection: selectedText,
          selectionType: isWord ? "word" : "sentence",
          paragraphText,
        });
      }, 10);
    },
    [getParagraphText]
  );

  const handleButtonClick = useCallback(() => {
    if (!floatingButton) return;

    if (floatingButton.selectionType === "word") {
      onWordSelect(floatingButton.selection, floatingButton.paragraphText);
    } else {
      // Get context sentences
      const sentences = floatingButton.paragraphText
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      let selectedIndex = -1;
      for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].includes(floatingButton.selection) || floatingButton.selection.includes(sentences[i])) {
          selectedIndex = i;
          break;
        }
      }

      if (selectedIndex === -1) {
        selectedIndex = Math.floor(sentences.length / 2);
      }

      const contextBefore = sentences.slice(Math.max(0, selectedIndex - 2), selectedIndex);
      const contextAfter = sentences.slice(selectedIndex + 1, Math.min(sentences.length, selectedIndex + 3));

      onSentenceSelect(floatingButton.selection, contextBefore, contextAfter);
    }

    setFloatingButton(null);
    window.getSelection()?.removeAllRanges();
  }, [floatingButton, onWordSelect, onSentenceSelect]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".floating-button")) {
      setFloatingButton(null);
    }
  }, []);

  // Attach event listeners
  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [handleMouseUp, handleClickOutside]);

  return (
    <div className="relative h-full" ref={editorRef}>
      <div className="tiptap-wrapper h-full overflow-auto rounded-lg border border-border bg-surface p-6">
        <EditorContent
          editor={editor}
          className="prose prose-invert max-w-none focus:outline-none"
        />
      </div>

      {/* Floating annotation button */}
      {floatingButton && (
        <button
          className="floating-button fixed z-50 flex items-center gap-2 rounded-lg bg-accent-gold px-4 py-2 text-sm font-medium text-black shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{
            left: floatingButton.x,
            top: floatingButton.y,
            transform: "translate(-50%, -100%)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleButtonClick();
          }}
        >
          <Sparkles className="h-4 w-4" />
          {floatingButton.selectionType === "word" ? "Annotate Word" : "Explain Sentence"}
        </button>
      )}
    </div>
  );
}
