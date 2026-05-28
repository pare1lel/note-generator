"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { BookOpen, ChevronDown, Loader2, Sun, Moon, FileText, RefreshCw, Plus, X, Save, Trash2, Settings as SettingsIcon, LogOut, MessageCircleQuestion } from "lucide-react";
import ReadingEditor, { ReadingEditorRef } from "@/components/ReadingEditor";
import { StyleReportCard, QACard } from "@/components/AnnotationCards";
import QAInputDialog from "@/components/QAInputDialog";
import Settings, { loadApiConfigs } from "@/components/Settings";
import ApiErrorDialog from "@/components/ApiErrorDialog";
import AuthPage from "@/components/AuthPage";
import {
  Article,
  WordAnnotation,
  SentenceAnnotation,
  StyleReport,
  QAItem,
  MarkPosition,
  ApiConfig,
  User,
} from "@/lib/types";
import {
  generateWordAnnotation,
  generateSentenceAnnotation,
  generateStyleReport,
} from "@/lib/llm-simulator";
import { streamGenerate } from "@/lib/stream-json";

type InlineAnnotation = WordAnnotation | SentenceAnnotation;

interface ApiRetryState {
  type: "word" | "sentence" | "style" | "qa";
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
  // qa params
  question?: string;
  inputLang?: "en" | "zh";
  qaPlaceholderId?: string;
  author?: string;
  // common
  pendingInfo?: { id: string; from: number; to: number; number: number };
  abortFlag?: React.RefObject<boolean>;
}

const EMPTY_BILINGUAL = { english: "", chinese: "" };

function makeEmptyStyleAnalysis(): StyleReport["analysis"] {
  return {
    diction: { ...EMPTY_BILINGUAL },
    sentenceStructure: { ...EMPTY_BILINGUAL },
    figureOfSpeech: { ...EMPTY_BILINGUAL },
    rhetoric: { ...EMPTY_BILINGUAL },
    tone: { ...EMPTY_BILINGUAL },
  };
}

export default function Home() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<InlineAnnotation[]>([]);
  const [savedMarks, setSavedMarks] = useState<MarkPosition[]>([]);
  const [styleReport, setStyleReport] = useState<StyleReport | null>(null);
  const [isGeneratingStyle, setIsGeneratingStyle] = useState(false);
  const [isStreamingStyle, setIsStreamingStyle] = useState(false);
  const styleReportAbortRef = useRef(false);
  const [qaList, setQaList] = useState<QAItem[]>([]);
  const [streamingQAIds, setStreamingQAIds] = useState<Set<string>>(new Set());
  const [showQADialog, setShowQADialog] = useState(false);
  const qaAbortRef = useRef(false);
  const editorRef = useRef<ReadingEditorRef>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalAuthor, setModalAuthor] = useState("");
  const [modalContent, setModalContent] = useState("");
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [apiRetry, setApiRetry] = useState<ApiRetryState | null>(null);
  const [streamingIds, setStreamingIds] = useState<Set<string>>(new Set());
  const [autoOpenAnnotationId, setAutoOpenAnnotationId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load API configs from localStorage on mount
  useEffect(() => {
    setApiConfigs(loadApiConfigs());
  }, []);

  // Check auth on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data ? { username: data.username } : null))
      .catch(() => setUser(null));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Load articles from DB after auth
  useEffect(() => {
    if (!user) return;
    fetch("/api/articles")
      .then((res) => res.json())
      .then((data: Article[]) => {
        setArticles(data);
        if (data.length > 0) {
          setSelectedArticleId(data[0].id);
        }
      });
  }, [user]);

  const selectedArticle = articles.find((a) => a.id === selectedArticleId) || null;

  // --- Streaming helpers ---

  const addStreamingId = useCallback((id: string) => {
    setStreamingIds((prev) => new Set(prev).add(id));
  }, []);

  const removeStreamingId = useCallback((id: string) => {
    setStreamingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Merge partial result into an annotation in state
  const mergeWordPartial = useCallback((id: string, partial: Record<string, unknown>) => {
    setAnnotations((prev) => prev.map((a) => {
      if (a.id !== id || a.type !== "word") return a;
      const w = a as WordAnnotation;
      const lit = partial.literalMeaning as { english?: string; chinese?: string } | undefined;
      const ctx = partial.contextualMeaning as { english?: string; chinese?: string } | undefined;
      return {
        ...w,
        literalMeaning: {
          english: lit?.english ?? w.literalMeaning.english,
          chinese: lit?.chinese ?? w.literalMeaning.chinese,
        },
        contextualMeaning: {
          english: ctx?.english ?? w.contextualMeaning.english,
          chinese: ctx?.chinese ?? w.contextualMeaning.chinese,
        },
      };
    }));
  }, []);

  const mergeSentencePartial = useCallback((id: string, partial: Record<string, unknown>) => {
    setAnnotations((prev) => prev.map((a) => {
      if (a.id !== id || a.type !== "sentence") return a;
      const s = a as SentenceAnnotation;
      const expl = partial.explanation as { english?: string; chinese?: string } | undefined;
      return {
        ...s,
        sentenceZh: (partial.sentenceZh as string) ?? s.sentenceZh,
        explanation: {
          english: expl?.english ?? s.explanation.english,
          chinese: expl?.chinese ?? s.explanation.chinese,
        },
        contextBeforeZh: (partial.contextBeforeZh as string[]) ?? s.contextBeforeZh,
        contextAfterZh: (partial.contextAfterZh as string[]) ?? s.contextAfterZh,
      };
    }));
  }, []);

  const mergeStylePartial = useCallback((partial: Record<string, unknown>) => {
    setStyleReport((prev) => {
      if (!prev) return prev;
      const analysis = partial.analysis as Record<string, { english?: string; chinese?: string }> | undefined;
      if (!analysis) return prev;
      const keys = ["diction", "sentenceStructure", "figureOfSpeech", "rhetoric", "tone"] as const;
      const merged = { ...prev.analysis };
      for (const k of keys) {
        if (analysis[k]) {
          merged[k] = {
            english: analysis[k].english ?? prev.analysis[k].english,
            chinese: analysis[k].chinese ?? prev.analysis[k].chinese,
          };
        }
      }
      return { ...prev, analysis: merged };
    });
  }, []);

  // --- QA streaming helpers ---

  const addStreamingQAId = useCallback((id: string) => {
    setStreamingQAIds((prev) => new Set(prev).add(id));
  }, []);

  const removeStreamingQAId = useCallback((id: string) => {
    setStreamingQAIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const mergeQAPartial = useCallback((qaId: string, partial: Record<string, unknown>) => {
    setQaList((prev) => prev.map((q) => {
      if (q.id !== qaId) return q;
      const qPart = partial.question as { english?: string; chinese?: string } | undefined;
      const aPart = partial.answer as { english?: string; chinese?: string } | undefined;
      return {
        ...q,
        question: {
          english: qPart?.english ?? q.question.english,
          chinese: qPart?.chinese ?? q.question.chinese,
        },
        answer: {
          english: aPart?.english ?? q.answer.english,
          chinese: aPart?.chinese ?? q.answer.chinese,
        },
      };
    }));
  }, []);

  // --- Load annotations + style report when article changes ---
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
    setIsStreamingStyle(false);
    styleReportAbortRef.current = false;

    const currentAbortFlag = styleReportAbortRef;

    fetch(`/api/articles/${selectedArticleId}/style-report`)
      .then((res) => (res.ok ? res.json() : null))
      .then((cached: StyleReport | null) => {
        if (currentAbortFlag.current) return;
        if (cached) {
          setStyleReport(cached);
          setIsGeneratingStyle(false);
        } else {
          doGenerateStyleReport(selectedArticleId, currentAbortFlag);
        }
      });

    // Load saved QA items
    qaAbortRef.current = true;
    setQaList([]);
    setStreamingQAIds(new Set());
    qaAbortRef.current = false;
    const currentQAAbortFlag = qaAbortRef;

    fetch(`/api/articles/${selectedArticleId}/qa`)
      .then((res) => (res.ok ? res.json() : []))
      .then((items: QAItem[]) => {
        if (currentQAAbortFlag.current) return;
        setQaList(items.map((q) => ({ ...q, timestamp: new Date(q.timestamp) })));
      });
  }, [selectedArticleId, articles]);

  // --- Style report generation (streaming) ---

  const completeStyleReport = useCallback(
    (report: StyleReport, articleId: string, abortFlag: React.RefObject<boolean>) => {
      if (abortFlag.current) return;
      setStyleReport(report);
      setIsGeneratingStyle(false);
      setIsStreamingStyle(false);
      if (!report.analysis) return;
      fetch(`/api/articles/${articleId}/style-report`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
    },
    []
  );

  const doGenerateStyleReport = useCallback(
    async (articleId: string, abortFlag: React.RefObject<boolean>) => {
      const article = articles.find((a) => a.id === articleId);
      if (!article) return;
      setIsGeneratingStyle(true);

      if (apiConfigs.length > 0) {
        // Create placeholder and show immediately
        const placeholderId = `style-${Date.now()}`;
        const placeholder: StyleReport = {
          id: placeholderId,
          type: "style",
          title: article.title,
          analysis: makeEmptyStyleAnalysis(),
          wordCount: article.content.split(/\s+/).length,
          timestamp: new Date(),
        };
        setStyleReport(placeholder);
        setIsStreamingStyle(true);

        try {
          const result = await streamGenerate(
            apiConfigs[0],
            "style",
            { title: article.title, content: article.content },
            (partial) => {
              if (abortFlag.current) return;
              mergeStylePartial(partial);
            }
          );
          const r = result as { analysis: StyleReport["analysis"]; wordCount: number };
          const report: StyleReport = {
            id: placeholderId,
            type: "style",
            title: article.title,
            analysis: r.analysis,
            wordCount: r.wordCount,
            model: apiConfigs[0].modelName,
            timestamp: new Date(),
          };
          completeStyleReport(report, articleId, abortFlag);
        } catch (err) {
          setIsStreamingStyle(false);
          setStyleReport(null);
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
    [articles, apiConfigs, completeStyleReport, mergeStylePartial]
  );

  const handleRegenerateStyle = useCallback(() => {
    if (!selectedArticleId || isGeneratingStyle) return;
    styleReportAbortRef.current = true;
    setStyleReport(null);
    styleReportAbortRef.current = false;
    doGenerateStyleReport(selectedArticleId, styleReportAbortRef);
  }, [selectedArticleId, isGeneratingStyle, doGenerateStyleReport]);

  // --- QA generation (streaming) ---

  const completeQA = useCallback(
    (qa: QAItem, articleId: string, abortFlag: React.RefObject<boolean>) => {
      if (abortFlag.current) return;
      setQaList((prev) => prev.map((q) => (q.id === qa.id ? qa : q)));
      removeStreamingQAId(qa.id);
      fetch(`/api/articles/${articleId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qa }),
      });
    },
    [removeStreamingQAId]
  );

  const doGenerateQA = useCallback(
    async (articleId: string, question: string, inputLang: "en" | "zh") => {
      const article = articles.find((a) => a.id === articleId);
      if (!article) return;
      const abortFlag = qaAbortRef;
      const placeholderId = `qa-${Date.now()}`;
      const placeholder: QAItem = {
        id: placeholderId,
        type: "qa",
        inputLang,
        question: inputLang === "en"
          ? { english: question, chinese: "" }
          : { english: "", chinese: question },
        answer: { ...EMPTY_BILINGUAL },
        timestamp: new Date(),
      };
      setQaList((prev) => [...prev, placeholder]);
      addStreamingQAId(placeholderId);

      if (apiConfigs.length > 0) {
        try {
          const result = await streamGenerate(
            apiConfigs[0],
            "qa",
            { title: article.title, author: article.author, content: article.content, question, inputLang },
            (partial) => {
              if (abortFlag.current) return;
              mergeQAPartial(placeholderId, partial);
            }
          );
          const r = result as { question: { english: string; chinese: string }; answer: { english: string; chinese: string } };
          const final: QAItem = {
            id: placeholderId,
            type: "qa",
            inputLang,
            question: r.question,
            answer: r.answer,
            model: apiConfigs[0].modelName,
            timestamp: new Date(),
          };
          completeQA(final, articleId, abortFlag);
        } catch (err) {
          removeStreamingQAId(placeholderId);
          setQaList((prev) => prev.filter((q) => q.id !== placeholderId));
          setApiRetry({
            type: "qa",
            configIndex: 0,
            error: err instanceof Error ? err.message : String(err),
            articleId,
            title: article.title,
            author: article.author,
            content: article.content,
            question,
            inputLang,
            qaPlaceholderId: placeholderId,
            abortFlag,
          });
        }
      } else {
        // No API configured: drop placeholder and surface notice via apiRetry-style
        removeStreamingQAId(placeholderId);
        setQaList((prev) => prev.filter((q) => q.id !== placeholderId));
      }
    },
    [articles, apiConfigs, addStreamingQAId, removeStreamingQAId, completeQA, mergeQAPartial]
  );

  const handleDeleteQA = useCallback(
    (qaId: string) => {
      if (!selectedArticleId) return;
      setQaList((prev) => prev.filter((q) => q.id !== qaId));
      fetch(`/api/articles/${selectedArticleId}/qa/${qaId}`, { method: "DELETE" });
    },
    [selectedArticleId]
  );

  // --- Word annotation (streaming) ---

  const completeWordAnnotation = useCallback(
    (annotation: WordAnnotation, pendingInfo: { id: string; from: number; to: number; number: number }, articleId: string) => {
      annotation.id = pendingInfo.id;
      setAnnotations((prev) => prev.map((a) => a.id === pendingInfo.id ? annotation : a));
      removeStreamingId(pendingInfo.id);
      fetch(`/api/articles/${articleId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotation,
          mark: { from: pendingInfo.from, to: pendingInfo.to, number: pendingInfo.number },
        }),
      });
    },
    [removeStreamingId]
  );

  const streamWordAnnotation = useCallback(
    async (config: ApiConfig, word: string, paragraph: string, pendingInfo: { id: string; from: number; to: number; number: number }, articleId: string) => {
      const article = articles.find((a) => a.id === articleId);
      try {
        const result = await streamGenerate(
          config,
          "word",
          { word, paragraph, title: article?.title, author: article?.author },
          (partial) => mergeWordPartial(pendingInfo.id, partial)
        );
        const r = result as { literalMeaning: { english: string; chinese: string }; contextualMeaning: { english: string; chinese: string } };
        const annotation: WordAnnotation = {
          id: pendingInfo.id,
          type: "word",
          word,
          paragraph,
          literalMeaning: r.literalMeaning,
          contextualMeaning: r.contextualMeaning,
          model: config.modelName,
          timestamp: new Date(),
        };
        completeWordAnnotation(annotation, pendingInfo, articleId);
      } catch (err) {
        removeStreamingId(pendingInfo.id);
        setAnnotations((prev) => prev.filter((a) => a.id !== pendingInfo.id));
        editorRef.current?.dismissAnnotation(pendingInfo.id);
        setApiRetry({
          type: "word",
          configIndex: apiConfigs.indexOf(config),
          error: err instanceof Error ? err.message : String(err),
          articleId,
          word,
          paragraph,
          pendingInfo,
        });
      }
    },
    [articles, apiConfigs, completeWordAnnotation, mergeWordPartial, removeStreamingId]
  );

  const handleWordSelect = useCallback(
    async (
      word: string,
      paragraph: string,
      pendingInfo: { id: string; from: number; to: number; number: number }
    ) => {
      if (!selectedArticleId) return;
      if (apiConfigs.length > 0) {
        // Create placeholder immediately
        const placeholder: WordAnnotation = {
          id: pendingInfo.id,
          type: "word",
          word,
          paragraph,
          literalMeaning: { ...EMPTY_BILINGUAL },
          contextualMeaning: { ...EMPTY_BILINGUAL },
          timestamp: new Date(),
        };
        setAnnotations((prev) => [...prev, placeholder]);
        addStreamingId(pendingInfo.id);
        setAutoOpenAnnotationId(pendingInfo.id);
        streamWordAnnotation(apiConfigs[0], word, paragraph, pendingInfo, selectedArticleId);
      } else {
        try {
          const annotation = await generateWordAnnotation(word, paragraph);
          annotation.id = pendingInfo.id;
          setAnnotations((prev) => [...prev, annotation]);
          setAutoOpenAnnotationId(pendingInfo.id);
        } catch (error) {
          console.error("Failed to generate word annotation:", error);
        }
      }
    },
    [selectedArticleId, apiConfigs, addStreamingId, streamWordAnnotation]
  );

  // --- Sentence annotation (streaming) ---

  const completeSentenceAnnotation = useCallback(
    (annotation: SentenceAnnotation, pendingInfo: { id: string; from: number; to: number; number: number }, articleId: string) => {
      annotation.id = pendingInfo.id;
      setAnnotations((prev) => prev.map((a) => a.id === pendingInfo.id ? annotation : a));
      removeStreamingId(pendingInfo.id);
      fetch(`/api/articles/${articleId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotation,
          mark: { from: pendingInfo.from, to: pendingInfo.to, number: pendingInfo.number },
        }),
      });
    },
    [removeStreamingId]
  );

  const streamSentenceAnnotation = useCallback(
    async (config: ApiConfig, sentence: string, contextBefore: string[], contextAfter: string[], pendingInfo: { id: string; from: number; to: number; number: number }, articleId: string) => {
      const article = articles.find((a) => a.id === articleId);
      try {
        const result = await streamGenerate(
          config,
          "sentence",
          { sentence, contextBefore, contextAfter, title: article?.title, author: article?.author },
          (partial) => mergeSentencePartial(pendingInfo.id, partial)
        );
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
          model: config.modelName,
          timestamp: new Date(),
        };
        completeSentenceAnnotation(annotation, pendingInfo, articleId);
      } catch (err) {
        removeStreamingId(pendingInfo.id);
        setAnnotations((prev) => prev.filter((a) => a.id !== pendingInfo.id));
        editorRef.current?.dismissAnnotation(pendingInfo.id);
        setApiRetry({
          type: "sentence",
          configIndex: apiConfigs.indexOf(config),
          error: err instanceof Error ? err.message : String(err),
          articleId,
          sentence,
          contextBefore,
          contextAfter,
          pendingInfo,
        });
      }
    },
    [articles, apiConfigs, completeSentenceAnnotation, mergeSentencePartial, removeStreamingId]
  );

  const handleSentenceSelect = useCallback(
    async (
      sentence: string,
      contextBefore: string[],
      contextAfter: string[],
      pendingInfo: { id: string; from: number; to: number; number: number }
    ) => {
      if (!selectedArticleId) return;
      if (apiConfigs.length > 0) {
        const placeholder: SentenceAnnotation = {
          id: pendingInfo.id,
          type: "sentence",
          sentence,
          contextBefore,
          contextAfter,
          explanation: { ...EMPTY_BILINGUAL },
          timestamp: new Date(),
        };
        setAnnotations((prev) => [...prev, placeholder]);
        addStreamingId(pendingInfo.id);
        setAutoOpenAnnotationId(pendingInfo.id);
        streamSentenceAnnotation(apiConfigs[0], sentence, contextBefore, contextAfter, pendingInfo, selectedArticleId);
      } else {
        try {
          const annotation = await generateSentenceAnnotation(sentence, contextBefore, contextAfter);
          annotation.id = pendingInfo.id;
          setAnnotations((prev) => [...prev, annotation]);
          setAutoOpenAnnotationId(pendingInfo.id);
        } catch (error) {
          console.error("Failed to generate sentence annotation:", error);
        }
      }
    },
    [selectedArticleId, apiConfigs, addStreamingId, streamSentenceAnnotation]
  );

  // --- Dismiss annotation ---

  const handleDismissAnnotation = useCallback(
    (id: string) => {
      if (!selectedArticleId) return;
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      fetch(`/api/articles/${selectedArticleId}/annotations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotationId: id }),
      });
    },
    [selectedArticleId]
  );

  // --- API retry ---

  const handleApiRetryNext = useCallback(async () => {
    if (!apiRetry) return;
    const nextIndex = apiRetry.configIndex + 1;
    if (nextIndex >= apiConfigs.length) {
      setApiRetry(null);
      return;
    }
    const config = apiConfigs[nextIndex];
    setApiRetry(null);

    if (apiRetry.type === "word" && apiRetry.word && apiRetry.pendingInfo) {
      // Re-create placeholder
      const placeholder: WordAnnotation = {
        id: apiRetry.pendingInfo.id,
        type: "word",
        word: apiRetry.word,
        paragraph: apiRetry.paragraph || "",
        literalMeaning: { ...EMPTY_BILINGUAL },
        contextualMeaning: { ...EMPTY_BILINGUAL },
        timestamp: new Date(),
      };
      setAnnotations((prev) => [...prev, placeholder]);
      addStreamingId(apiRetry.pendingInfo.id);
      setAutoOpenAnnotationId(apiRetry.pendingInfo.id);
      streamWordAnnotation(config, apiRetry.word, apiRetry.paragraph || "", apiRetry.pendingInfo, apiRetry.articleId);
    } else if (apiRetry.type === "sentence" && apiRetry.sentence && apiRetry.pendingInfo) {
      const placeholder: SentenceAnnotation = {
        id: apiRetry.pendingInfo.id,
        type: "sentence",
        sentence: apiRetry.sentence,
        contextBefore: apiRetry.contextBefore || [],
        contextAfter: apiRetry.contextAfter || [],
        explanation: { ...EMPTY_BILINGUAL },
        timestamp: new Date(),
      };
      setAnnotations((prev) => [...prev, placeholder]);
      addStreamingId(apiRetry.pendingInfo.id);
      setAutoOpenAnnotationId(apiRetry.pendingInfo.id);
      streamSentenceAnnotation(config, apiRetry.sentence, apiRetry.contextBefore || [], apiRetry.contextAfter || [], apiRetry.pendingInfo, apiRetry.articleId);
    } else if (apiRetry.type === "style" && apiRetry.title != null) {
      const abortFlag = apiRetry.abortFlag || { current: false };
      const placeholderId = `style-${Date.now()}`;
      const placeholder: StyleReport = {
        id: placeholderId,
        type: "style",
        title: apiRetry.title,
        analysis: makeEmptyStyleAnalysis(),
        wordCount: (apiRetry.content || "").split(/\s+/).length,
        timestamp: new Date(),
      };
      setStyleReport(placeholder);
      setIsGeneratingStyle(true);
      setIsStreamingStyle(true);
      try {
        const result = await streamGenerate(
          config,
          "style",
          { title: apiRetry.title, content: apiRetry.content },
          (partial) => { if (!abortFlag.current) mergeStylePartial(partial); }
        );
        const r = result as { analysis: StyleReport["analysis"]; wordCount: number };
        const report: StyleReport = {
          id: placeholderId,
          type: "style",
          title: apiRetry.title!,
          analysis: r.analysis,
          wordCount: r.wordCount,
          model: config.modelName,
          timestamp: new Date(),
        };
        completeStyleReport(report, apiRetry.articleId, abortFlag);
      } catch (err) {
        setIsStreamingStyle(false);
        setStyleReport(null);
        setApiRetry({
          ...apiRetry,
          configIndex: nextIndex,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (apiRetry.type === "qa" && apiRetry.question != null && apiRetry.inputLang != null && apiRetry.title != null) {
      const abortFlag = apiRetry.abortFlag || { current: false };
      const placeholderId = apiRetry.qaPlaceholderId || `qa-${Date.now()}`;
      const placeholder: QAItem = {
        id: placeholderId,
        type: "qa",
        inputLang: apiRetry.inputLang,
        question: apiRetry.inputLang === "en"
          ? { english: apiRetry.question, chinese: "" }
          : { english: "", chinese: apiRetry.question },
        answer: { ...EMPTY_BILINGUAL },
        timestamp: new Date(),
      };
      setQaList((prev) => [...prev, placeholder]);
      addStreamingQAId(placeholderId);
      try {
        const result = await streamGenerate(
          config,
          "qa",
          { title: apiRetry.title, author: apiRetry.author, content: apiRetry.content, question: apiRetry.question, inputLang: apiRetry.inputLang },
          (partial) => { if (!abortFlag.current) mergeQAPartial(placeholderId, partial); }
        );
        const r = result as { question: { english: string; chinese: string }; answer: { english: string; chinese: string } };
        const final: QAItem = {
          id: placeholderId,
          type: "qa",
          inputLang: apiRetry.inputLang,
          question: r.question,
          answer: r.answer,
          model: config.modelName,
          timestamp: new Date(),
        };
        completeQA(final, apiRetry.articleId, abortFlag);
      } catch (err) {
        removeStreamingQAId(placeholderId);
        setQaList((prev) => prev.filter((q) => q.id !== placeholderId));
        setApiRetry({
          ...apiRetry,
          configIndex: nextIndex,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }, [apiRetry, apiConfigs, addStreamingId, addStreamingQAId, removeStreamingQAId, streamWordAnnotation, streamSentenceAnnotation, completeStyleReport, completeQA, mergeStylePartial, mergeQAPartial]);

  const handleApiUseFallback = useCallback(async () => {
    if (!apiRetry) return;
    setApiRetry(null);
    try {
      if (apiRetry.type === "word" && apiRetry.word && apiRetry.pendingInfo) {
        const annotation = await generateWordAnnotation(apiRetry.word, apiRetry.paragraph || "");
        annotation.id = apiRetry.pendingInfo.id;
        setAnnotations((prev) => [...prev, annotation]);
        setAutoOpenAnnotationId(apiRetry.pendingInfo.id);
      } else if (apiRetry.type === "sentence" && apiRetry.sentence && apiRetry.pendingInfo) {
        const annotation = await generateSentenceAnnotation(apiRetry.sentence, apiRetry.contextBefore || [], apiRetry.contextAfter || []);
        annotation.id = apiRetry.pendingInfo.id;
        setAnnotations((prev) => [...prev, annotation]);
        setAutoOpenAnnotationId(apiRetry.pendingInfo.id);
      } else if (apiRetry.type === "style" && apiRetry.title != null) {
        const report = await generateStyleReport(apiRetry.title, apiRetry.content || "");
        const abortFlag = apiRetry.abortFlag || { current: false };
        completeStyleReport(report, apiRetry.articleId, abortFlag);
      }
      // QA: no simulator fallback — silently dismiss
    } catch (error) {
      console.error("Fallback generation failed:", error);
      if (apiRetry.type === "style") setIsGeneratingStyle(false);
    }
  }, [apiRetry, completeStyleReport]);

  // --- Article management ---

  const handleArticleChange = useCallback((articleId: string) => {
    setSelectedArticleId(articleId);
    setAnnotations([]);
    setSavedMarks([]);
    setStreamingIds(new Set());
    setAutoOpenAnnotationId(null);
    qaAbortRef.current = true;
    setQaList([]);
    setStreamingQAIds(new Set());
  }, []);

  const reloadArticles = useCallback(async () => {
    const res = await fetch("/api/articles");
    const data: Article[] = await res.json();
    setArticles(data);
    return data;
  }, []);

  const openAddModal = useCallback(() => {
    setModalTitle("");
    setModalAuthor("");
    setModalContent("");
    setShowAddModal(true);
  }, []);

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

  const handleDeleteArticle = useCallback(async () => {
    if (!selectedArticle) return;
    if (!confirm(`Delete "${selectedArticle.title}"? This will also delete all its annotations.`)) return;
    await fetch(`/api/articles/${selectedArticle.id}`, { method: "DELETE" });
    const data = await reloadArticles();
    const next = data.find((a) => a.id !== selectedArticle.id);
    setAnnotations([]);
    setSavedMarks([]);
    setQaList([]);
    setSelectedArticleId(next?.id ?? null);
  }, [selectedArticle, reloadArticles]);

  const handleSaveArticle = useCallback(async () => {
    if (!selectedArticle || !editorRef.current) return;
    const raw = editorRef.current.getContent();
    const tmp = document.createElement("div");
    tmp.innerHTML = raw;
    tmp.querySelectorAll("span[data-annotation-id]").forEach((el) => {
      el.replaceWith(...el.childNodes);
    });
    const html = tmp.innerHTML;
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
      setQaList([]);
      setSelectedArticleId(updated.id);
    }
  }, [selectedArticle, reloadArticles]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setArticles([]);
    setSelectedArticleId(null);
    setAnnotations([]);
    setSavedMarks([]);
    setStyleReport(null);
    setQaList([]);
  }, []);

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
      </div>
    );
  }

  if (user === null) {
    return <AuthPage onSuccess={(username) => setUser({ username })} />;
  }

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

            <div className="flex items-center gap-2 border-l border-border pl-4">
              <span className="rounded-lg border border-border bg-surface-light px-3 py-2 text-sm text-primary">{user.username}</span>
              <button
                onClick={handleLogout}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-light transition-colors hover:bg-surface"
                title="Logout"
              >
                <LogOut className="h-4 w-4 text-secondary hover:text-accent-rose" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex items-start gap-6 p-6">
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
                onClick={() => setShowQADialog(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-light px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-surface hover:text-violet-300"
                title="Ask a question about this article"
              >
                <MessageCircleQuestion className="h-3.5 w-3.5" />
                QA
              </button>
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
            autoOpenAnnotationId={autoOpenAnnotationId}
            streamingIds={streamingIds}
            onWordSelect={handleWordSelect}
            onSentenceSelect={handleSentenceSelect}
            onDismissAnnotation={handleDismissAnnotation}
          />

          {qaList.length > 0 && (
            <div className="mt-4 space-y-3">
              {qaList.map((qa) => (
                <QACard
                  key={qa.id}
                  qa={qa}
                  isStreaming={streamingQAIds.has(qa.id)}
                  onDelete={handleDeleteQA}
                />
              ))}
            </div>
          )}
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

          <div className="overflow-auto">
            {styleReport ? (
              <StyleReportCard annotation={styleReport} isStreaming={isStreamingStyle} />
            ) : isGeneratingStyle ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-accent-rose" />
                <p className="text-sm text-secondary">Generating style analysis...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
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

      {/* QA Input Dialog */}
      <QAInputDialog
        open={showQADialog}
        onClose={() => setShowQADialog(false)}
        onSubmit={(question, lang) => {
          if (!selectedArticleId) return;
          doGenerateQA(selectedArticleId, question, lang);
          setShowQADialog(false);
        }}
        disabled={apiConfigs.length === 0}
        disabledReason={apiConfigs.length === 0 ? "Add an API config in Settings first." : undefined}
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
