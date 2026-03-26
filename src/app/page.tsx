"use client";

import { useState, useCallback } from "react";
import { BookOpen, Wand2, Trash2, ChevronDown, Loader2 } from "lucide-react";
import ReadingEditor from "@/components/ReadingEditor";
import AnnotationCard from "@/components/AnnotationCards";
import { Annotation } from "@/lib/types";
import { sampleArticles } from "@/lib/articles";
import {
  generateWordAnnotation,
  generateSentenceAnnotation,
  generateStyleReport,
} from "@/lib/llm-simulator";

export default function Home() {
  const [selectedArticleId, setSelectedArticleId] = useState(sampleArticles[0].id);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [selectedSentences, setSelectedSentences] = useState<Set<string>>(new Set());

  const selectedArticle = sampleArticles.find((a) => a.id === selectedArticleId) || sampleArticles[0];

  // Handle word double-click
  const handleWordSelect = useCallback(async (word: string, paragraph: string) => {
    // Avoid duplicate annotations for the same word in quick succession
    const existingKey = `${word}-${paragraph.substring(0, 50)}`;
    if (selectedWords.has(existingKey)) return;

    setSelectedWords((prev) => new Set(prev).add(existingKey));

    try {
      const annotation = await generateWordAnnotation(word, paragraph);
      setAnnotations((prev) => [...prev, annotation]);
    } catch (error) {
      console.error("Failed to generate word annotation:", error);
    }
  }, [selectedWords]);

  // Handle sentence drag selection
  const handleSentenceSelect = useCallback(
    async (sentence: string, contextBefore: string[], contextAfter: string[]) => {
      // Avoid duplicate annotations
      if (selectedSentences.has(sentence)) return;
      setSelectedSentences((prev) => new Set(prev).add(sentence));

      try {
        const annotation = await generateSentenceAnnotation(
          sentence,
          contextBefore,
          contextAfter
        );
        setAnnotations((prev) => [...prev, annotation]);
      } catch (error) {
        console.error("Failed to generate sentence annotation:", error);
      }
    },
    [selectedSentences]
  );

  // Handle style report generation
  const handleGenerateStyleReport = useCallback(async () => {
    setIsGenerating(true);
    try {
      const annotation = await generateStyleReport(
        selectedArticle.title,
        selectedArticle.content
      );
      setAnnotations((prev) => [...prev, annotation]);
    } catch (error) {
      console.error("Failed to generate style report:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedArticle]);

  // Clear all annotations
  const handleClearAll = useCallback(() => {
    setAnnotations([]);
    setSelectedWords(new Set());
    setSelectedSentences(new Set());
  }, []);

  // Dismiss single annotation
  const handleDismiss = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-gold/10">
              <BookOpen className="h-5 w-5 text-accent-gold" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-primary">Reading Notes</h1>
              <p className="text-xs text-secondary">LLM-Powered English Learning</p>
            </div>
          </div>

          {/* Article Selector */}
          <div className="relative">
            <select
              value={selectedArticleId}
              onChange={(e) => {
                setSelectedArticleId(e.target.value);
                setAnnotations([]);
                setSelectedWords(new Set());
                setSelectedSentences(new Set());
              }}
              className="appearance-none rounded-lg border border-border bg-surface-light px-4 py-2 pr-10 text-sm text-primary focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
            >
              {sampleArticles.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.title}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 gap-6 p-6">
        {/* Reading Panel */}
        <div className="flex w-3/5 flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-primary">{selectedArticle.title}</h2>
              {selectedArticle.author && (
                <p className="text-sm text-secondary">by {selectedArticle.author}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-secondary">
              <span className="rounded-full bg-surface-light px-2 py-1">
                Double-click word for definition
              </span>
              <span className="rounded-full bg-surface-light px-2 py-1">
                Drag to select sentence
              </span>
            </div>
          </div>

          <ReadingEditor
            content={selectedArticle.content}
            onWordSelect={handleWordSelect}
            onSentenceSelect={handleSentenceSelect}
            selectedWords={selectedWords}
            selectedSentences={selectedSentences}
          />
        </div>

        {/* Annotation Panel */}
        <div className="flex w-2/5 flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-primary">Annotations</h2>
            <span className="rounded-full bg-surface-light px-2 py-1 text-xs text-secondary">
              {annotations.length} items
            </span>
          </div>

          {/* Toolbar */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={handleGenerateStyleReport}
              disabled={isGenerating}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-rose/10 px-4 py-2 text-sm font-medium text-accent-rose transition-colors hover:bg-accent-rose/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate Style Report
                </>
              )}
            </button>
            <button
              onClick={handleClearAll}
              disabled={annotations.length === 0}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-secondary transition-colors hover:bg-surface-light hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </button>
          </div>

          {/* Annotation List */}
          <div className="flex-1 space-y-4 overflow-auto">
            {annotations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-light">
                  <BookOpen className="h-8 w-8 text-secondary" />
                </div>
                <p className="text-sm text-secondary">Select text to generate annotations</p>
                <p className="mt-1 text-xs text-secondary">
                  Double-click a word or drag to select a sentence
                </p>
              </div>
            ) : (
              annotations.map((annotation) => (
                <AnnotationCard
                  key={annotation.id}
                  annotation={annotation}
                  onDismiss={handleDismiss}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
