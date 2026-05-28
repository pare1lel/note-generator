"use client";

import { useState, useEffect } from "react";
import { MessageCircleQuestion, X } from "lucide-react";

interface QAInputDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (question: string, inputLang: "en" | "zh") => void;
  disabled?: boolean;
  disabledReason?: string;
}

export default function QAInputDialog({
  open,
  onClose,
  onSubmit,
  disabled,
  disabledReason,
}: QAInputDialogProps) {
  const [question, setQuestion] = useState("");
  const [lang, setLang] = useState<"en" | "zh">("en");

  useEffect(() => {
    if (!open) {
      setQuestion("");
      setLang("en");
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = question.trim().length > 0 && !disabled;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(question.trim(), lang);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl annotation-popup">
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-400/10">
              <MessageCircleQuestion className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary">Ask a question</h3>
              <p className="text-xs text-secondary">The answer will reference the full article.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-secondary hover:bg-surface-light hover:text-primary transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-secondary">Language</span>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-light p-0.5">
              <button
                onClick={() => setLang("en")}
                className={`rounded-md px-3 py-1 text-xs transition-colors ${
                  lang === "en" ? "bg-violet-400/20 text-violet-300" : "text-secondary hover:text-primary"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("zh")}
                className={`rounded-md px-3 py-1 text-xs transition-colors ${
                  lang === "zh" ? "bg-violet-400/20 text-violet-300" : "text-secondary hover:text-primary"
                }`}
              >
                中
              </button>
            </div>
          </div>

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={lang === "en" ? "e.g. What does the last leaf symbolize?" : "例如:最后一片叶子象征着什么?"}
            rows={4}
            autoFocus
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary placeholder:text-secondary/60 focus:border-violet-400/60 focus:outline-none"
          />

          {disabled && disabledReason && (
            <p className="text-xs text-red-400">{disabledReason}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-secondary transition-colors hover:bg-surface-light hover:text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-violet-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
