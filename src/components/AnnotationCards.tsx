"use client";

import { X, Trash2, BookOpen, MessageSquare, FileText } from "lucide-react";
import { Annotation, WordAnnotation, SentenceAnnotation, StyleReport } from "@/lib/types";

interface AnnotationCardProps {
  annotation: Annotation;
  onDismiss: (id: string) => void;
}

/** Renders text with a blinking cursor when streaming and field is non-empty, or a placeholder when empty */
function StreamText({ text, isStreaming, className }: { text: string; isStreaming?: boolean; className?: string }) {
  if (isStreaming && !text) {
    return <span className={`streaming-cursor text-secondary/40 ${className || ""}`} />;
  }
  return (
    <span className={className}>
      {text}
      {isStreaming && text && <span className="streaming-cursor" />}
    </span>
  );
}

export function WordAnnotationCard({
  annotation,
  isStreaming,
  onClose,
  onDelete,
  className,
}: {
  annotation: WordAnnotation;
  isStreaming?: boolean;
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
              disabled={isStreaming}
              className="rounded p-1 text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
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
          <p className="text-sm text-primary">
            <StreamText text={annotation.literalMeaning.english} isStreaming={isStreaming} />
          </p>
          <p className="mt-1 text-sm text-secondary">
            <StreamText text={annotation.literalMeaning.chinese} isStreaming={isStreaming} />
          </p>
        </div>

        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-secondary">
            Contextual Meaning
          </h4>
          <p className="text-sm text-primary">
            <StreamText text={annotation.contextualMeaning.english} isStreaming={isStreaming} />
          </p>
          <p className="mt-1 text-sm text-secondary">
            <StreamText text={annotation.contextualMeaning.chinese} isStreaming={isStreaming} />
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-secondary">
        <span>{new Date(annotation.timestamp).toLocaleTimeString()}</span>
        {isStreaming ? (
          <span className="rounded-full bg-surface-light px-2 py-0.5 animate-pulse">streaming...</span>
        ) : annotation.model ? (
          <span className="rounded-full bg-surface-light px-2 py-0.5">{annotation.model}</span>
        ) : null}
      </div>
    </div>
  );
}

export function SentenceAnnotationCard({
  annotation,
  isStreaming,
  onClose,
  onDelete,
  className,
}: {
  annotation: SentenceAnnotation;
  isStreaming?: boolean;
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
              disabled={isStreaming}
              className="rounded p-1 text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
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
              <div key={`before-${i}`}>
                <p className="text-xs text-secondary">...{ctx}</p>
                {annotation.contextBeforeZh?.[i] && (
                  <p className="text-xs text-secondary/70">{annotation.contextBeforeZh[i]}</p>
                )}
              </div>
            ))}
            <div>
              <p className="text-sm font-medium text-primary">
                {annotation.sentence}
              </p>
              {(annotation.sentenceZh || isStreaming) && (
                <p className="text-xs text-secondary/70">
                  <StreamText text={annotation.sentenceZh || ""} isStreaming={isStreaming} />
                </p>
              )}
            </div>
            {annotation.contextAfter.map((ctx, i) => (
              <div key={`after-${i}`}>
                <p className="text-xs text-secondary">{ctx}...</p>
                {annotation.contextAfterZh?.[i] && (
                  <p className="text-xs text-secondary/70">{annotation.contextAfterZh[i]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-secondary">
            In My Own Words
          </h4>
          <p className="text-sm text-primary">
            <StreamText text={annotation.explanation.english} isStreaming={isStreaming} />
          </p>
          <p className="mt-1 text-sm text-secondary">
            <StreamText text={annotation.explanation.chinese} isStreaming={isStreaming} />
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-secondary">
        <span>{new Date(annotation.timestamp).toLocaleTimeString()}</span>
        {isStreaming ? (
          <span className="rounded-full bg-surface-light px-2 py-0.5 animate-pulse">streaming...</span>
        ) : annotation.model ? (
          <span className="rounded-full bg-surface-light px-2 py-0.5">{annotation.model}</span>
        ) : null}
      </div>
    </div>
  );
}

export function StyleReportCard({
  annotation,
  isStreaming,
}: {
  annotation: StyleReport;
  isStreaming?: boolean;
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
            <p className="text-sm text-primary">
              <StreamText text={analysis[key].english} isStreaming={isStreaming} />
            </p>
            <p className="mt-1 text-sm text-secondary">
              <StreamText text={analysis[key].chinese} isStreaming={isStreaming} />
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-end border-t border-border pt-2 text-xs text-secondary">
        {isStreaming ? (
          <span className="rounded-full bg-surface-light px-2 py-0.5 animate-pulse">streaming...</span>
        ) : annotation.model ? (
          <span className="rounded-full bg-surface-light px-2 py-0.5">{annotation.model}</span>
        ) : null}
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
