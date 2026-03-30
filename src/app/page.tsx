"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { BookOpen, ChevronDown, Loader2, Sun, Moon, FileText } from "lucide-react";
import ReadingEditor from "@/components/ReadingEditor";
import { StyleReportCard } from "@/components/AnnotationCards";
import {
  Article,
  WordAnnotation,
  SentenceAnnotation,
  StyleReport,
  MarkPosition,
} from "@/lib/types";
import {
  generateWordAnnotation,
  generateSentenceAnnotation,
  generateStyleReport,
} from "@/lib/llm-simulator";

type InlineAnnotation = WordAnnotation | SentenceAnnotation;

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<InlineAnnotation[]>([]);
  const [savedMarks, setSavedMarks] = useState<MarkPosition[]>([]);
  const [styleReport, setStyleReport] = useState<StyleReport | null>(null);
  const [isGeneratingStyle, setIsGeneratingStyle] = useState(false);
  const styleReportAbortRef = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Load articles from DB on mount
  useEffect(() => {
    fetch("/api/articles")
      .then((res) => res.json())
      .then((data: Article[]) => {
        setArticles(data);
        if (data.length > 0) {
          setSelectedArticleId(data[0].id);
        }
      });
  }, []);

  const selectedArticle = articles.find((a) => a.id === selectedArticleId) || null;

  // Load annotations + style report when article changes
  useEffect(() => {
    if (!selectedArticleId) return;

    // Load annotations
    fetch(`/api/articles/${selectedArticleId}/annotations`)
      .then((res) => res.json())
      .then((stored: { annotation: InlineAnnotation; mark: MarkPosition }[]) => {
        setAnnotations(stored.map((s) => s.annotation));
        setSavedMarks(stored.map((s) => ({ ...s.mark, id: s.annotation.id })));
      });

    // Load or generate style report
    styleReportAbortRef.current = true;
    setStyleReport(null);
    setIsGeneratingStyle(true);
    styleReportAbortRef.current = false;

    const currentAbortFlag = styleReportAbortRef;

    fetch(`/api/articles/${selectedArticleId}/style-report`)
      .then((res) => res.json())
      .then((cached: StyleReport | null) => {
        if (currentAbortFlag.current) return;
        if (cached) {
          setStyleReport(cached);
          setIsGeneratingStyle(false);
        } else {
          // Generate and save
          const article = articles.find((a) => a.id === selectedArticleId);
          if (!article) return;
          generateStyleReport(article.title, article.content)
            .then((report) => {
              if (currentAbortFlag.current) return;
              setStyleReport(report);
              fetch(`/api/articles/${selectedArticleId}/style-report`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(report),
              });
            })
            .finally(() => {
              if (!currentAbortFlag.current) setIsGeneratingStyle(false);
            });
        }
      });
  }, [selectedArticleId, articles]);

  // Handle word annotation
  const handleWordSelect = useCallback(
    async (
      word: string,
      paragraph: string,
      pendingInfo: { id: string; from: number; to: number; number: number }
    ) => {
      if (!selectedArticleId) return;
      try {
        const annotation = await generateWordAnnotation(word, paragraph);
        annotation.id = pendingInfo.id;
        setAnnotations((prev) => [...prev, annotation]);

        // Auto-save to DB
        fetch(`/api/articles/${selectedArticleId}/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            annotation,
            mark: { from: pendingInfo.from, to: pendingInfo.to, number: pendingInfo.number },
          }),
        });
      } catch (error) {
        console.error("Failed to generate word annotation:", error);
      }
    },
    [selectedArticleId]
  );

  // Handle sentence annotation
  const handleSentenceSelect = useCallback(
    async (
      sentence: string,
      contextBefore: string[],
      contextAfter: string[],
      pendingInfo: { id: string; from: number; to: number; number: number }
    ) => {
      if (!selectedArticleId) return;
      try {
        const annotation = await generateSentenceAnnotation(
          sentence,
          contextBefore,
          contextAfter
        );
        annotation.id = pendingInfo.id;
        setAnnotations((prev) => [...prev, annotation]);

        // Auto-save to DB
        fetch(`/api/articles/${selectedArticleId}/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            annotation,
            mark: { from: pendingInfo.from, to: pendingInfo.to, number: pendingInfo.number },
          }),
        });
      } catch (error) {
        console.error("Failed to generate sentence annotation:", error);
      }
    },
    [selectedArticleId]
  );

  // Dismiss annotation
  const handleDismissAnnotation = useCallback(
    (id: string) => {
      if (!selectedArticleId) return;
      setAnnotations((prev) => prev.filter((a) => a.id !== id));

      // Auto-delete from DB
      fetch(`/api/articles/${selectedArticleId}/annotations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotationId: id }),
      });
    },
    [selectedArticleId]
  );

  // Change article
  const handleArticleChange = useCallback((articleId: string) => {
    setSelectedArticleId(articleId);
    setAnnotations([]);
    setSavedMarks([]);
  }, []);

  if (!selectedArticle) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
      </div>
    );
  }

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
                value={selectedArticleId ?? ""}
                onChange={(e) => handleArticleChange(e.target.value)}
                className="appearance-none rounded-lg border border-border bg-surface-light px-4 py-2 pr-10 text-sm text-primary focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
              >
                {articles.map((article) => (
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
            savedMarks={savedMarks}
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
