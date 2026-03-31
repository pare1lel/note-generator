"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { BookOpen, ChevronDown, Loader2, Sun, Moon, FileText, RefreshCw, Plus, X, Save, Trash2, Settings as SettingsIcon } from "lucide-react";
import ReadingEditor, { ReadingEditorRef } from "@/components/ReadingEditor";
import { StyleReportCard } from "@/components/AnnotationCards";
import Settings, { loadApiConfigs } from "@/components/Settings";
import ApiErrorDialog from "@/components/ApiErrorDialog";
import {
  Article,
  WordAnnotation,
  SentenceAnnotation,
  StyleReport,
  MarkPosition,
  ApiConfig,
} from "@/lib/types";
import {
  generateWordAnnotation,
  generateSentenceAnnotation,
  generateStyleReport,
} from "@/lib/llm-simulator";

type InlineAnnotation = WordAnnotation | SentenceAnnotation;

interface ApiRetryState {
  type: "word" | "sentence" | "style";
  configIndex: number;
  error: string;
  articleId: string;
  // word params
  word?: string;
  paragraph?: string;
  // sentence params
  sentence?: string;
  contextBefore?: string[];
  contextAfter?: string[];
  // style params
  title?: string;
  content?: string;
  // common
  pendingInfo?: { id: string; from: number; to: number; number: number };
  abortFlag?: React.RefObject<boolean>;
}

async function callGenerateApi(
  config: ApiConfig,
  type: "word" | "sentence" | "style",
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: config.baseUrl,
      model: config.modelName,
      apiKey: config.apiKey,
      type,
      params,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data.result;
}

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
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [apiRetry, setApiRetry] = useState<ApiRetryState | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load API configs from localStorage on mount
  useEffect(() => {
    setApiConfigs(loadApiConfigs());
  }, []);

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

  // Complete style report: save to state and DB
  const completeStyleReport = useCallback(
    (report: StyleReport, articleId: string, abortFlag: React.RefObject<boolean>) => {
      if (abortFlag.current) return;
      setStyleReport(report);
      setIsGeneratingStyle(false);
      fetch(`/api/articles/${articleId}/style-report`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
    },
    []
  );

  // Generate style report — try API first, then fallback
  const doGenerateStyleReport = useCallback(
    async (articleId: string, abortFlag: React.RefObject<boolean>) => {
      const article = articles.find((a) => a.id === articleId);
      if (!article) return;
      setIsGeneratingStyle(true);

      if (apiConfigs.length > 0) {
        try {
          const result = await callGenerateApi(apiConfigs[0], "style", { title: article.title, content: article.content });
          const r = result as { analysis: StyleReport["analysis"]; wordCount: number };
          const report: StyleReport = {
            id: `style-${Date.now()}`,
            type: "style",
            title: article.title,
            analysis: r.analysis,
            wordCount: r.wordCount,
            model: apiConfigs[0].modelName,
            timestamp: new Date(),
          };
          completeStyleReport(report, articleId, abortFlag);
        } catch (err) {
          setApiRetry({
            type: "style",
            configIndex: 0,
            error: err instanceof Error ? err.message : String(err),
            articleId,
            title: article.title,
            content: article.content,
            abortFlag,
          });
        }
      } else {
        generateStyleReport(article.title, article.content)
          .then((report) => completeStyleReport(report, articleId, abortFlag))
          .catch(() => { if (!abortFlag.current) setIsGeneratingStyle(false); });
      }
    },
    [articles, apiConfigs, completeStyleReport]
  );

  // Regenerate style report
  const handleRegenerateStyle = useCallback(() => {
    if (!selectedArticleId || isGeneratingStyle) return;
    styleReportAbortRef.current = true;
    setStyleReport(null);
    styleReportAbortRef.current = false;
    doGenerateStyleReport(selectedArticleId, styleReportAbortRef);
  }, [selectedArticleId, isGeneratingStyle, doGenerateStyleReport]);

  // Try API generation for word annotation, falling back on error
  const completeWordAnnotation = useCallback(
    (annotation: WordAnnotation, pendingInfo: { id: string; from: number; to: number; number: number }, articleId: string) => {
      annotation.id = pendingInfo.id;
      setAnnotations((prev) => [...prev, annotation]);
      fetch(`/api/articles/${articleId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotation,
          mark: { from: pendingInfo.from, to: pendingInfo.to, number: pendingInfo.number },
        }),
      });
    },
    []
  );

  // Handle word annotation
  const handleWordSelect = useCallback(
    async (
      word: string,
      paragraph: string,
      pendingInfo: { id: string; from: number; to: number; number: number }
    ) => {
      if (!selectedArticleId) return;
      if (apiConfigs.length > 0) {
        try {
          const result = await callGenerateApi(apiConfigs[0], "word", { word, paragraph });
          const r = result as { literalMeaning: { english: string; chinese: string }; contextualMeaning: { english: string; chinese: string } };
          const annotation: WordAnnotation = {
            id: pendingInfo.id,
            type: "word",
            word,
            paragraph,
            literalMeaning: r.literalMeaning,
            contextualMeaning: r.contextualMeaning,
            model: apiConfigs[0].modelName,
            timestamp: new Date(),
          };
          completeWordAnnotation(annotation, pendingInfo, selectedArticleId);
        } catch (err) {
          setApiRetry({
            type: "word",
            configIndex: 0,
            error: err instanceof Error ? err.message : String(err),
            articleId: selectedArticleId,
            word,
            paragraph,
            pendingInfo,
          });
        }
      } else {
        try {
          const annotation = await generateWordAnnotation(word, paragraph);
          completeWordAnnotation(annotation, pendingInfo, selectedArticleId);
        } catch (error) {
          console.error("Failed to generate word annotation:", error);
        }
      }
    },
    [selectedArticleId, apiConfigs, completeWordAnnotation]
  );

  // Try API generation for sentence annotation
  const completeSentenceAnnotation = useCallback(
    (annotation: SentenceAnnotation, pendingInfo: { id: string; from: number; to: number; number: number }, articleId: string) => {
      annotation.id = pendingInfo.id;
      setAnnotations((prev) => [...prev, annotation]);
      fetch(`/api/articles/${articleId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotation,
          mark: { from: pendingInfo.from, to: pendingInfo.to, number: pendingInfo.number },
        }),
      });
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
      if (!selectedArticleId) return;
      if (apiConfigs.length > 0) {
        try {
          const result = await callGenerateApi(apiConfigs[0], "sentence", { sentence, contextBefore, contextAfter });
          const r = result as { sentenceZh?: string; explanation: { english: string; chinese: string }; contextBeforeZh?: string[]; contextAfterZh?: string[] };
          const annotation: SentenceAnnotation = {
            id: pendingInfo.id,
            type: "sentence",
            sentence,
            sentenceZh: r.sentenceZh,
            contextBefore,
            contextAfter,
            contextBeforeZh: r.contextBeforeZh,
            contextAfterZh: r.contextAfterZh,
            explanation: r.explanation,
            model: apiConfigs[0].modelName,
            timestamp: new Date(),
          };
          completeSentenceAnnotation(annotation, pendingInfo, selectedArticleId);
        } catch (err) {
          setApiRetry({
            type: "sentence",
            configIndex: 0,
            error: err instanceof Error ? err.message : String(err),
            articleId: selectedArticleId,
            sentence,
            contextBefore,
            contextAfter,
            pendingInfo,
          });
        }
      } else {
        try {
          const annotation = await generateSentenceAnnotation(sentence, contextBefore, contextAfter);
          completeSentenceAnnotation(annotation, pendingInfo, selectedArticleId);
        } catch (error) {
          console.error("Failed to generate sentence annotation:", error);
        }
      }
    },
    [selectedArticleId, apiConfigs, completeSentenceAnnotation]
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

  // API retry: try next config
  const handleApiRetryNext = useCallback(async () => {
    if (!apiRetry) return;
    const nextIndex = apiRetry.configIndex + 1;
    if (nextIndex >= apiConfigs.length) {
      // No more configs, fall through to fallback
      setApiRetry(null);
      return;
    }
    const config = apiConfigs[nextIndex];
    try {
      if (apiRetry.type === "word" && apiRetry.word && apiRetry.pendingInfo) {
        const result = await callGenerateApi(config, "word", { word: apiRetry.word, paragraph: apiRetry.paragraph });
        const r = result as { literalMeaning: { english: string; chinese: string }; contextualMeaning: { english: string; chinese: string } };
        const annotation: WordAnnotation = {
          id: apiRetry.pendingInfo.id,
          type: "word",
          word: apiRetry.word,
          paragraph: apiRetry.paragraph || "",
          literalMeaning: r.literalMeaning,
          contextualMeaning: r.contextualMeaning,
          model: config.modelName,
          timestamp: new Date(),
        };
        completeWordAnnotation(annotation, apiRetry.pendingInfo, apiRetry.articleId);
        setApiRetry(null);
      } else if (apiRetry.type === "sentence" && apiRetry.sentence && apiRetry.pendingInfo) {
        const result = await callGenerateApi(config, "sentence", { sentence: apiRetry.sentence, contextBefore: apiRetry.contextBefore, contextAfter: apiRetry.contextAfter });
        const r = result as { sentenceZh?: string; explanation: { english: string; chinese: string }; contextBeforeZh?: string[]; contextAfterZh?: string[] };
        const annotation: SentenceAnnotation = {
          id: apiRetry.pendingInfo.id,
          type: "sentence",
          sentence: apiRetry.sentence,
          sentenceZh: r.sentenceZh,
          contextBefore: apiRetry.contextBefore || [],
          contextAfter: apiRetry.contextAfter || [],
          contextBeforeZh: r.contextBeforeZh,
          contextAfterZh: r.contextAfterZh,
          explanation: r.explanation,
          model: config.modelName,
          timestamp: new Date(),
        };
        completeSentenceAnnotation(annotation, apiRetry.pendingInfo, apiRetry.articleId);
        setApiRetry(null);
      } else if (apiRetry.type === "style" && apiRetry.title != null) {
        const result = await callGenerateApi(config, "style", { title: apiRetry.title, content: apiRetry.content });
        const r = result as { analysis: StyleReport["analysis"]; wordCount: number };
        const report: StyleReport = {
          id: `style-${Date.now()}`,
          type: "style",
          title: apiRetry.title,
          analysis: r.analysis,
          wordCount: r.wordCount,
          model: config.modelName,
          timestamp: new Date(),
        };
        const abortFlag = apiRetry.abortFlag || { current: false };
        completeStyleReport(report, apiRetry.articleId, abortFlag);
        setApiRetry(null);
      }
    } catch (err) {
      setApiRetry({ ...apiRetry, configIndex: nextIndex, error: err instanceof Error ? err.message : String(err) });
    }
  }, [apiRetry, apiConfigs, completeWordAnnotation, completeSentenceAnnotation, completeStyleReport]);

  // API fallback: use demo generator
  const handleApiUseFallback = useCallback(async () => {
    if (!apiRetry) return;
    setApiRetry(null);
    try {
      if (apiRetry.type === "word" && apiRetry.word && apiRetry.pendingInfo) {
        const annotation = await generateWordAnnotation(apiRetry.word, apiRetry.paragraph || "");
        completeWordAnnotation(annotation, apiRetry.pendingInfo, apiRetry.articleId);
      } else if (apiRetry.type === "sentence" && apiRetry.sentence && apiRetry.pendingInfo) {
        const annotation = await generateSentenceAnnotation(apiRetry.sentence, apiRetry.contextBefore || [], apiRetry.contextAfter || []);
        completeSentenceAnnotation(annotation, apiRetry.pendingInfo, apiRetry.articleId);
      } else if (apiRetry.type === "style" && apiRetry.title != null) {
        const report = await generateStyleReport(apiRetry.title, apiRetry.content || "");
        const abortFlag = apiRetry.abortFlag || { current: false };
        completeStyleReport(report, apiRetry.articleId, abortFlag);
      }
    } catch (error) {
      console.error("Fallback generation failed:", error);
      if (apiRetry.type === "style") setIsGeneratingStyle(false);
    }
  }, [apiRetry, completeWordAnnotation, completeSentenceAnnotation, completeStyleReport]);

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

  // Delete current article
  const handleDeleteArticle = useCallback(async () => {
    if (!selectedArticle) return;
    if (!confirm(`Delete "${selectedArticle.title}"? This will also delete all its annotations.`)) return;
    await fetch(`/api/articles/${selectedArticle.id}`, { method: "DELETE" });
    const data = await reloadArticles();
    const next = data.find((a) => a.id !== selectedArticle.id);
    setAnnotations([]);
    setSavedMarks([]);
    setSelectedArticleId(next?.id ?? null);
  }, [selectedArticle, reloadArticles]);

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

            <button
              onClick={() => setShowSettings(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-light transition-colors hover:bg-surface"
              title="Settings"
            >
              <SettingsIcon className="h-5 w-5 text-secondary hover:text-accent-gold" />
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
              <button
                onClick={handleDeleteArticle}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-surface-light px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                title="Delete this article"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
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
      {/* Settings Modal */}
      <Settings
        open={showSettings}
        onClose={() => setShowSettings(false)}
        configs={apiConfigs}
        onConfigsChange={setApiConfigs}
      />

      {/* API Error Dialog */}
      {apiRetry && (
        <ApiErrorDialog
          error={apiRetry.error}
          modelName={apiConfigs[apiRetry.configIndex]?.modelName || "unknown"}
          hasNext={apiRetry.configIndex + 1 < apiConfigs.length}
          onTryNext={handleApiRetryNext}
          onUseFallback={handleApiUseFallback}
        />
      )}
    </div>
  );
}
