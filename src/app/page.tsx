"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { BookOpen, ChevronDown, Loader2, Sun, Moon, FileText, RefreshCw, Plus, X, Save } from "lucide-react";
import ReadingEditor, { ReadingEditorRef } from "@/components/ReadingEditor";
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
  const editorRef = useRef<ReadingEditorRef>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalAuthor, setModalAuthor] = useState("");
  const [modalContent, setModalContent] = useState("");

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
          doGenerateStyleReport(selectedArticleId, currentAbortFlag);
        }
      });
  }, [selectedArticleId, articles]);

  // Generate style report and save to DB
  const doGenerateStyleReport = useCallback(
    (articleId: string, abortFlag: React.RefObject<boolean>) => {
      const article = articles.find((a) => a.id === articleId);
      if (!article) return;
      setIsGeneratingStyle(true);
      generateStyleReport(article.title, article.content)
        .then((report) => {
          if (abortFlag.current) return;
          setStyleReport(report);
          fetch(`/api/articles/${articleId}/style-report`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(report),
          });
        })
        .finally(() => {
          if (!abortFlag.current) setIsGeneratingStyle(false);
        });
    },
    [articles]
  );

  // Regenerate style report
  const handleRegenerateStyle = useCallback(() => {
    if (!selectedArticleId || isGeneratingStyle) return;
    styleReportAbortRef.current = true;
    setStyleReport(null);
    styleReportAbortRef.current = false;
    doGenerateStyleReport(selectedArticleId, styleReportAbortRef);
  }, [selectedArticleId, isGeneratingStyle, doGenerateStyleReport]);

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

  // Reload articles from DB
  const reloadArticles = useCallback(async () => {
    const res = await fetch("/api/articles");
    const data: Article[] = await res.json();
    setArticles(data);
    return data;
  }, []);

  // Open add modal
  const openAddModal = useCallback(() => {
    setModalTitle("");
    setModalAuthor("");
    setModalContent("");
    setShowAddModal(true);
  }, []);

  // Save new article from modal
  const handleAddArticle = useCallback(async () => {
    if (!modalTitle.trim() || !modalContent.trim()) return;
    const res = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: modalTitle.trim(),
        content: modalContent.trim(),
        author: modalAuthor.trim() || undefined,
      }),
    });
    const created: Article = await res.json();
    await reloadArticles();
    handleArticleChange(created.id);
    setShowAddModal(false);
  }, [modalTitle, modalAuthor, modalContent, reloadArticles, handleArticleChange]);

  // Save current editor content to DB
  const handleSaveArticle = useCallback(async () => {
    if (!selectedArticle || !editorRef.current) return;
    const html = editorRef.current.getContent();
    await fetch(`/api/articles/${selectedArticle.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selectedArticle.title,
        content: html,
        author: selectedArticle.author || undefined,
      }),
    });
    const data = await reloadArticles();
    const updated = data.find((a) => a.id === selectedArticle.id);
    if (updated) {
      setAnnotations([]);
      setSavedMarks([]);
      setSelectedArticleId(updated.id);
    }
  }, [selectedArticle, reloadArticles]);

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

            <button
              onClick={openAddModal}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-light transition-colors hover:bg-surface"
              title="Add new article"
            >
              <Plus className="h-5 w-5 text-secondary hover:text-accent-gold" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 gap-6 p-6">
        {/* Reading Panel */}
        <div className="flex w-[65%] flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
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
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveArticle}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-light px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-surface hover:text-primary"
                title="Save article changes"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
              <span className="rounded-full bg-surface-light px-2 py-1 text-xs text-secondary">
                Select text to annotate
              </span>
            </div>
          </div>

          <ReadingEditor
            ref={editorRef}
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
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent-rose" />
              <h2 className="text-lg font-medium text-primary">Style Report</h2>
            </div>
            <button
              onClick={handleRegenerateStyle}
              disabled={isGeneratingStyle}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-light px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-surface hover:text-primary disabled:opacity-50"
              title="Regenerate style report"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingStyle ? "animate-spin" : ""}`} />
              Regenerate
            </button>
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

      {/* Article Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 flex w-full max-w-2xl flex-col rounded-xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-primary">Add Article</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-light hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-secondary">Title</label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="Article title"
                  className="w-full rounded-lg border border-border bg-surface-light px-4 py-2 text-sm text-primary placeholder:text-secondary/50 focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-secondary">Author (optional)</label>
                <input
                  type="text"
                  value={modalAuthor}
                  onChange={(e) => setModalAuthor(e.target.value)}
                  placeholder="Author name"
                  className="w-full rounded-lg border border-border bg-surface-light px-4 py-2 text-sm text-primary placeholder:text-secondary/50 focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-secondary">Content</label>
                <textarea
                  value={modalContent}
                  onChange={(e) => setModalContent(e.target.value)}
                  placeholder="Paste or type article content..."
                  rows={12}
                  className="w-full resize-y rounded-lg border border-border bg-surface-light px-4 py-2 text-sm text-primary placeholder:text-secondary/50 focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-secondary transition-colors hover:bg-surface-light hover:text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddArticle}
                disabled={!modalTitle.trim() || !modalContent.trim()}
                className="rounded-lg bg-accent-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:brightness-110 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
