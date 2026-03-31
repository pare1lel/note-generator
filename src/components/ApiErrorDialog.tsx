"use client";

import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";

interface ApiErrorDialogProps {
  error: string;
  modelName: string;
  hasNext: boolean;
  onTryNext: () => void;
  onUseFallback: () => void;
}

export default function ApiErrorDialog({
  error,
  modelName,
  hasNext,
  onTryNext,
  onUseFallback,
}: ApiErrorDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl annotation-popup">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary">API Error</h3>
            <p className="text-xs text-secondary">Model: {modelName}</p>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-4 py-3">
            <p className="text-sm text-red-300 break-words whitespace-pre-wrap">{error}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onUseFallback}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-secondary transition-colors hover:bg-surface-light hover:text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Use Demo Fallback
          </button>
          {hasNext && (
            <button
              onClick={onTryNext}
              className="flex items-center gap-1.5 rounded-lg bg-accent-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:brightness-110"
            >
              Try Next API
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
