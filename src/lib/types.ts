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
  timestamp: Date;
}

export interface SentenceAnnotation {
  id: string;
  type: "sentence";
  sentence: string;
  contextBefore: string[];
  contextAfter: string[];
  explanation: {
    english: string;
    chinese: string;
  };
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
  timestamp: Date;
}

export type Annotation = WordAnnotation | SentenceAnnotation | StyleReport;

export interface Article {
  id: string;
  title: string;
  content: string;
  author?: string;
}
