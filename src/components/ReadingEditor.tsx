"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import AnnotationMark from "@/extensions/annotation-mark";
import AnnotationPopup from "./AnnotationPopup";
import { WordAnnotation, SentenceAnnotation, MarkPosition } from "@/lib/types";

type InlineAnnotation = WordAnnotation | SentenceAnnotation;

interface PendingAnnotation {
  id: string;
  from: number;
  to: number;
  number: number;
  type: "word" | "sentence";
}

interface ReadingEditorProps {
  content: string;
  annotations: InlineAnnotation[];
  savedMarks?: MarkPosition[];
  onWordSelect: (
    word: string,
    paragraph: string,
    pendingInfo: { id: string; from: number; to: number; number: number }
  ) => void;
  onSentenceSelect: (
    sentence: string,
    contextBefore: string[],
    contextAfter: string[],
    pendingInfo: { id: string; from: number; to: number; number: number }
  ) => void;
  onDismissAnnotation: (id: string) => void;
}

interface FloatingButton {
  x: number;
  y: number;
  selection: string;
  selectionType: "word" | "sentence";
  paragraphText: string;
  from: number;
  to: number;
}

export interface ReadingEditorRef {
  getContent: () => string;
}

const ReadingEditor = forwardRef<ReadingEditorRef, ReadingEditorProps>(function ReadingEditor({
  content,
  annotations,
  savedMarks,
  onWordSelect,
  onSentenceSelect,
  onDismissAnnotation,
}, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [floatingButton, setFloatingButton] = useState<FloatingButton | null>(null);
  const pendingAnnotationsRef = useRef<PendingAnnotation[]>([]);
  const appliedAnnotationIdsRef = useRef<Set<string>>(new Set());
  const [activePopup, setActivePopup] = useState<{
    annotationId: string;
  } | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, AnnotationMark],
    content: content,
    editable: true,
    immediatelyRender: false,
  });

  useImperativeHandle(ref, () => ({
    getContent: () => editor?.getHTML() ?? "",
  }), [editor]);

  // Update editor content when article changes
  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content);
      pendingAnnotationsRef.current = [];
      appliedAnnotationIdsRef.current.clear();
      setActivePopup(null);
      setFloatingButton(null);
    }
  }, [editor, content]);

  // Seed pending annotations from saved mark positions (loaded from DB)
  useEffect(() => {
    if (!savedMarks?.length) return;
    for (const mark of savedMarks) {
      if (
        !appliedAnnotationIdsRef.current.has(mark.id) &&
        !pendingAnnotationsRef.current.some((p) => p.id === mark.id)
      ) {
        pendingAnnotationsRef.current.push({
          id: mark.id,
          from: mark.from,
          to: mark.to,
          number: mark.number,
          type: mark.type,
        });
      }
    }
  }, [savedMarks]);

  // Apply marks when new annotations arrive
  useEffect(() => {
    if (!editor) return;

    for (const pending of pendingAnnotationsRef.current) {
      const annotation = annotations.find((a) => a.id === pending.id);
      if (annotation && !appliedAnnotationIdsRef.current.has(pending.id)) {
        const { tr } = editor.state;
        const markType = editor.schema.marks.annotationMark;
        tr.addMark(
          pending.from,
          pending.to,
          markType.create({
            id: pending.id,
            number: String(pending.number),
            annotationType: pending.type,
          })
        );
        editor.view.dispatch(tr);
        appliedAnnotationIdsRef.current.add(pending.id);
      }
    }

    // Clean up pending entries that have been applied
    pendingAnnotationsRef.current = pendingAnnotationsRef.current.filter(
      (p) => !appliedAnnotationIdsRef.current.has(p.id)
    );
  }, [editor, annotations]);

  const getParagraphText = useCallback((node: Node): string => {
    let element = node;
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement!;
    }
    const paragraph =
      (element as Element).closest("p") || (element as Element).closest("div");
    return paragraph?.textContent || "";
  }, []);

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      // Don't interfere with popup
      if ((e.target as HTMLElement).closest(".annotation-popup")) return;

      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          setFloatingButton(null);
          return;
        }

        const selectedText = selection.toString().trim();
        if (!selectedText || !editor) {
          setFloatingButton(null);
          return;
        }

        // Check if mouseup is within editor
        if (!editorRef.current?.contains(selection.anchorNode)) {
          setFloatingButton(null);
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const isWord =
          !selectedText.includes(" ") && selectedText.split(/\s+/).length === 1;
        const paragraphText = getParagraphText(range.commonAncestorContainer);

        // Get ProseMirror positions
        const view = editor.view;
        const from = view.posAtDOM(range.startContainer, range.startOffset);
        const to = view.posAtDOM(range.endContainer, range.endOffset);

        setFloatingButton({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
          selection: selectedText,
          selectionType: isWord ? "word" : "sentence",
          paragraphText,
          from,
          to,
        });
      }, 10);
    },
    [editor, getParagraphText]
  );

  const getNextAnnotationNumber = useCallback(() => {
    const usedNumbers = new Set<number>();
    for (const p of pendingAnnotationsRef.current) {
      usedNumbers.add(p.number);
    }
    if (editor) {
      const markType = editor.schema.marks.annotationMark;
      editor.state.doc.descendants((node) => {
        if (!node.isText) return;
        for (const mark of node.marks) {
          if (mark.type === markType) {
            const num = parseInt(mark.attrs.number, 10);
            if (!isNaN(num)) usedNumbers.add(num);
          }
        }
      });
    }
    let n = 1;
    while (usedNumbers.has(n)) n++;
    return n;
  }, [editor]);

  const handleButtonClick = useCallback(() => {
    if (!floatingButton || !editor) return;

    const number = getNextAnnotationNumber();
    const id =
      floatingButton.selectionType === "word"
        ? `word-${Date.now()}`
        : `sentence-${Date.now()}`;

    // Store pending annotation info for mark application
    pendingAnnotationsRef.current.push({
      id,
      from: floatingButton.from,
      to: floatingButton.to,
      number,
      type: floatingButton.selectionType,
    });

    if (floatingButton.selectionType === "word") {
      onWordSelect(floatingButton.selection, floatingButton.paragraphText, {
        id,
        from: floatingButton.from,
        to: floatingButton.to,
        number,
      });
    } else {
      const sentences = floatingButton.paragraphText
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      let selectedIndex = -1;
      for (let i = 0; i < sentences.length; i++) {
        if (
          sentences[i].includes(floatingButton.selection) ||
          floatingButton.selection.includes(sentences[i])
        ) {
          selectedIndex = i;
          break;
        }
      }
      if (selectedIndex === -1) {
        selectedIndex = Math.floor(sentences.length / 2);
      }

      const contextBefore = sentences.slice(
        Math.max(0, selectedIndex - 2),
        selectedIndex
      );
      const contextAfter = sentences.slice(
        selectedIndex + 1,
        Math.min(sentences.length, selectedIndex + 3)
      );

      onSentenceSelect(
        floatingButton.selection,
        contextBefore,
        contextAfter,
        { id, from: floatingButton.from, to: floatingButton.to, number }
      );
    }

    setFloatingButton(null);
    window.getSelection()?.removeAllRanges();
  }, [floatingButton, editor, onWordSelect, onSentenceSelect, getNextAnnotationNumber]);

  // Handle clicks on annotation badges
  const handleEditorClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains("annotation-badge")) {
        const annotationId = target.dataset.annotationId;
        if (annotationId) {
          setActivePopup({ annotationId });
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    []
  );

  const handleDismiss = useCallback(
    (id: string) => {
      if (!editor) return;

      // Remove the mark from the editor
      const { doc, tr } = editor.state;
      const markType = editor.schema.marks.annotationMark;

      doc.descendants((node, pos) => {
        if (node.isText) {
          const mark = node.marks.find(
            (m) => m.type === markType && m.attrs.id === id
          );
          if (mark) {
            tr.removeMark(pos, pos + node.nodeSize, mark);
          }
        }
      });

      editor.view.dispatch(tr);
      appliedAnnotationIdsRef.current.delete(id);
      setActivePopup(null);
      onDismissAnnotation(id);
    },
    [editor, onDismissAnnotation]
  );

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".floating-button") &&
        !target.closest(".annotation-badge")
      ) {
        setFloatingButton(null);
      }
    },
    []
  );

  // Capture-phase mousedown to prevent ProseMirror from placing cursor on badge click
  const handleAnnotationMouseDown = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("annotation-badge")) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    []
  );

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [handleMouseUp, handleClickOutside]);

  // Attach click + capture-phase mousedown to editor
  useEffect(() => {
    const editorEl = editorRef.current;
    if (!editorEl) return;

    editorEl.addEventListener("mousedown", handleAnnotationMouseDown, true);
    editorEl.addEventListener("click", handleEditorClick);
    return () => {
      editorEl.removeEventListener("mousedown", handleAnnotationMouseDown, true);
      editorEl.removeEventListener("click", handleEditorClick);
    };
  }, [handleAnnotationMouseDown, handleEditorClick]);

  const activeAnnotation = activePopup
    ? annotations.find((a) => a.id === activePopup.annotationId)
    : null;

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
          {floatingButton.selectionType === "word"
            ? "Annotate Word"
            : "Explain Sentence"}
        </button>
      )}

      {/* Annotation popup */}
      {activePopup && activeAnnotation && (
        <AnnotationPopup
          annotation={activeAnnotation}
          onClose={() => setActivePopup(null)}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
});

export default ReadingEditor;
