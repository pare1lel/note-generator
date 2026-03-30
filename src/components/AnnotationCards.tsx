"use client";

import { X, Trash2, BookOpen, MessageSquare, FileText } from "lucide-react";
import { Annotation, WordAnnotation, SentenceAnnotation, StyleReport } from "@/lib/types";

interface AnnotationCardProps {
  annotation: Annotation;
  onDismiss: (id: string) => void;
}

export function WordAnnotationCard({
  annotation,
  onClose,
  onDelete,
  className,
}: {
  annotation: WordAnnotation;
  onClose?: () => void;
  onDelete?: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`annotation-card rounded-lg border-l-4 border-accent-gold bg-surface p-4 shadow-lg ${className || ""}`}>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent-gold" />
          <span className="text-sm font-medium text-accent-gold">Word Analysis</span>
        </div>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              onClick={() => onDelete(annotation.id)}
              className="rounded p-1 text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors"
              title="Delete annotation"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded p-1 text-secondary hover:bg-surface-light hover:text-primary transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-md bg-surface-light/50 p-3">
        <span className="text-xl font-semibold italic text-primary">
          &ldquo;{annotation.word}&rdquo;
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-secondary">
            Literal Meaning
          </h4>
          <p className="text-sm text-primary">{annotation.literalMeaning.english}</p>
          <p className="mt-1 text-sm text-secondary">{annotation.literalMeaning.chinese}</p>
        </div>

        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-secondary">
            Contextual Meaning
          </h4>
          <p className="text-sm text-primary">{annotation.contextualMeaning.english}</p>
          <p className="mt-1 text-sm text-secondary">{annotation.contextualMeaning.chinese}</p>
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-2 text-xs text-secondary">
        {new Date(annotation.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

export function SentenceAnnotationCard({
  annotation,
  onClose,
  onDelete,
  className,
}: {
  annotation: SentenceAnnotation;
  onClose?: () => void;
  onDelete?: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`annotation-card rounded-lg border-l-4 border-accent-teal bg-surface p-4 shadow-lg ${className || ""}`}>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent-teal" />
          <span className="text-sm font-medium text-accent-teal">Sentence Explanation</span>
        </div>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              onClick={() => onDelete(annotation.id)}
              className="rounded p-1 text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors"
              title="Delete annotation"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded p-1 text-secondary hover:bg-surface-light hover:text-primary transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-md bg-surface-light/50 p-3">
        <p className="text-sm italic text-primary">&ldquo;{annotation.sentence}&rdquo;</p>
      </div>

      {(annotation.contextBefore.length > 0 || annotation.contextAfter.length > 0) && (
        <div className="mb-4 rounded-md bg-background/50 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-secondary">
            Context
          </p>
          <div className="space-y-1">
            {annotation.contextBefore.map((ctx, i) => (
              <p key={`before-${i}`} className="text-xs text-secondary">
                ...{ctx}
              </p>
            ))}
            <p className="text-sm font-medium italic text-primary">
              &rarr; {annotation.sentence}
            </p>
            {annotation.contextAfter.map((ctx, i) => (
              <p key={`after-${i}`} className="text-xs text-secondary">
                {ctx}...
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-secondary">
            In My Own Words
          </h4>
          <p className="text-sm text-primary">{annotation.explanation.english}</p>
          <p className="mt-1 text-sm text-secondary">{annotation.explanation.chinese}</p>
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-2 text-xs text-secondary">
        {new Date(annotation.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

export function StyleReportCard({
  annotation,
}: {
  annotation: StyleReport;
}) {
  const { analysis, wordCount } = annotation;

  const sections = [
    { key: "diction", label: "Diction" },
    { key: "sentenceStructure", label: "Sentence Structure" },
    { key: "figureOfSpeech", label: "Figure of Speech" },
    { key: "rhetoric", label: "Rhetoric" },
    { key: "tone", label: "Tone" },
  ] as const;

  return (
    <div className="annotation-card rounded-lg border-l-4 border-accent-rose bg-surface p-4 shadow-lg">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent-rose" />
          <span className="text-sm font-medium text-accent-rose">Writing Style Analysis</span>
        </div>
        <span className="rounded-full bg-accent-rose/20 px-2 py-0.5 text-xs text-accent-rose">
          ~{wordCount} words
        </span>
      </div>

      <div className="mb-4 rounded-md bg-surface-light/50 p-3">
        <span className="text-sm font-medium text-primary">&ldquo;{annotation.title}&rdquo;</span>
      </div>

      <div className="space-y-4">
        {sections.map(({ key, label }) => (
          <div key={key}>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-secondary">
              {label}
            </h4>
            <p className="text-sm text-primary">{analysis[key].english}</p>
            <p className="mt-1 text-sm text-secondary">{analysis[key].chinese}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnnotationCard({ annotation, onDismiss }: AnnotationCardProps) {
  switch (annotation.type) {
    case "word":
      return <WordAnnotationCard annotation={annotation} onDelete={onDismiss} />;
    case "sentence":
      return <SentenceAnnotationCard annotation={annotation} onDelete={onDismiss} />;
    case "style":
      return <StyleReportCard annotation={annotation} />;
    default:
      return null;
  }
}
