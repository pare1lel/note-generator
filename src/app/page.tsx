"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { BookOpen, ChevronDown, Loader2, Sun, Moon, FileText } from "lucide-react";
import ReadingEditor from "@/components/ReadingEditor";
import { StyleReportCard } from "@/components/AnnotationCards";
import { WordAnnotation, SentenceAnnotation, StyleReport } from "@/lib/types";
import { sampleArticles } from "@/lib/articles";
import {
  generateWordAnnotation,
  generateSentenceAnnotation,
  generateStyleReport,
} from "@/lib/llm-simulator";

type InlineAnnotation = WordAnnotation | SentenceAnnotation;

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [selectedArticleId, setSelectedArticleId] = useState(sampleArticles[0].id);
  const [annotations, setAnnotations] = useState<InlineAnnotation[]>([]);
  const [styleReport, setStyleReport] = useState<StyleReport | null>(null);
  const [isGeneratingStyle, setIsGeneratingStyle] = useState(false);
  const styleReportAbortRef = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const selectedArticle =
    sampleArticles.find((a) => a.id === selectedArticleId) || sampleArticles[0];

  // Auto-generate style report when article changes
  useEffect(() => {
    styleReportAbortRef.current = true; // abort any in-flight generation
    setStyleReport(null);
    setIsGeneratingStyle(true);
    styleReportAbortRef.current = false;

    const currentAbortFlag = styleReportAbortRef;

    generateStyleReport(selectedArticle.title, selectedArticle.content)
      .then((report) => {
        if (!currentAbortFlag.current) {
          setStyleReport(report);
        }
      })
      .catch((error) => {
        console.error("Failed to generate style report:", error);
      })
      .finally(() => {
        if (!currentAbortFlag.current) {
          setIsGeneratingStyle(false);
        }
      });
  }, [selectedArticle]);

  // Handle word annotation
  const handleWordSelect = useCallback(
    async (
      word: string,
      paragraph: string,
      pendingInfo: { id: string; from: number; to: number; number: number }
    ) => {
      try {
        const annotation = await generateWordAnnotation(word, paragraph);
        // Override the ID with the one from the editor
        annotation.id = pendingInfo.id;
        setAnnotations((prev) => [...prev, annotation]);
      } catch (error) {
        console.error("Failed to generate word annotation:", error);
      }
    },
    []
  );

  // Handle sentence annotation
  const handleSentenceSelect = useCallback(
    async (
      sentence: string,
      contextBefore: string[],
      contextAfter: string[],
      pendingInfo: { id: string; from: number; to: number; number: number }
    ) => {
      try {
        const annotation = await generateSentenceAnnotation(
          sentence,
          contextBefore,
          contextAfter
        );
        annotation.id = pendingInfo.id;
        setAnnotations((prev) => [...prev, annotation]);
      } catch (error) {
        console.error("Failed to generate sentence annotation:", error);
      }
    },
    []
  );

  // Dismiss annotation
  const handleDismissAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Clear annotations on article change
  const handleArticleChange = useCallback((articleId: string) => {
    setSelectedArticleId(articleId);
    setAnnotations([]);
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

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-light transition-colors hover:bg-surface"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-secondary hover:text-accent-gold" />
              ) : (
                <Moon className="h-5 w-5 text-secondary hover:text-accent-rose" />
              )}
            </button>

            <div className="relative">
              <select
                value={selectedArticleId}
                onChange={(e) => handleArticleChange(e.target.value)}
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 gap-6 p-6">
        {/* Reading Panel */}
        <div className="flex w-[65%] flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-primary">
                {selectedArticle.title}
              </h2>
              {selectedArticle.author && (
                <p className="text-sm text-secondary">
                  by {selectedArticle.author}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-secondary">
              <span className="rounded-full bg-surface-light px-2 py-1">
                Select text to annotate
              </span>
            </div>
          </div>

          <ReadingEditor
            content={selectedArticle.content}
            annotations={annotations}
            onWordSelect={handleWordSelect}
            onSentenceSelect={handleSentenceSelect}
            onDismissAnnotation={handleDismissAnnotation}
          />
        </div>

        {/* Style Report Panel */}
        <div className="flex w-[35%] flex-col">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent-rose" />
            <h2 className="text-lg font-medium text-primary">Style Report</h2>
          </div>

          <div className="flex-1 overflow-auto">
            {isGeneratingStyle ? (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-accent-rose" />
                <p className="text-sm text-secondary">Generating style analysis...</p>
              </div>
            ) : styleReport ? (
              <StyleReportCard annotation={styleReport} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
                <FileText className="mb-4 h-8 w-8 text-secondary" />
                <p className="text-sm text-secondary">
                  Style report could not be generated
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
