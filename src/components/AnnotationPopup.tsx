"use client";

import { useEffect } from "react";
import { WordAnnotation, SentenceAnnotation } from "@/lib/types";
import { WordAnnotationCard, SentenceAnnotationCard } from "./AnnotationCards";

interface AnnotationPopupProps {
  annotation: WordAnnotation | SentenceAnnotation;
  onClose: () => void;
  onDismiss: (id: string) => void;
}

export default function AnnotationPopup({
  annotation,
  onClose,
  onDismiss,
}: AnnotationPopupProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const modalCardClass = "relative z-10 w-full max-h-full overflow-auto rounded-xl border border-border shadow-2xl p-6";

  return (
    <div className="annotation-popup fixed inset-0 z-[100] flex items-center justify-center p-8">
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {annotation.type === "word" ? (
        <WordAnnotationCard
          annotation={annotation}
          onClose={onClose}
          onDelete={onDismiss}
          className={modalCardClass}
        />
      ) : (
        <SentenceAnnotationCard
          annotation={annotation}
          onClose={onClose}
          onDelete={onDismiss}
          className={modalCardClass}
        />
      )}
    </div>
  );
}
