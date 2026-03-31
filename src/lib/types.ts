export interface WordAnnotation {
  id: string;
  type: "word";
  word: string;
  paragraph: string;
  literalMeaning: {
    english: string;
    chinese: string;
  };
  contextualMeaning: {
    english: string;
    chinese: string;
  };
  model?: string;
  timestamp: Date;
}

export interface SentenceAnnotation {
  id: string;
  type: "sentence";
  sentence: string;
  sentenceZh?: string;
  contextBefore: string[];
  contextAfter: string[];
  contextBeforeZh?: string[];
  contextAfterZh?: string[];
  explanation: {
    english: string;
    chinese: string;
  };
  model?: string;
  timestamp: Date;
}

export interface StyleReport {
  id: string;
  type: "style";
  title: string;
  analysis: {
    diction: { english: string; chinese: string };
    sentenceStructure: { english: string; chinese: string };
    figureOfSpeech: { english: string; chinese: string };
    rhetoric: { english: string; chinese: string };
    tone: { english: string; chinese: string };
  };
  wordCount: number;
  model?: string;
  timestamp: Date;
}

export type Annotation = WordAnnotation | SentenceAnnotation | StyleReport;

export interface MarkPosition {
  id: string;
  from: number;
  to: number;
  number: number;
  type: "word" | "sentence";
}

export interface Article {
  id: string;
  title: string;
  content: string;
  author?: string;
}

export interface ApiConfig {
  id: string;
  baseUrl: string;
  modelName: string;
  apiKey: string;
}

export interface User {
  username: string;
}
