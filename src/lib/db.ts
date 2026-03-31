import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { sampleArticles } from "./articles";
import type { Article, WordAnnotation, SentenceAnnotation, StyleReport } from "./types";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "notes.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      author TEXT,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('word', 'sentence')),
      data TEXT NOT NULL,
      mark_from INTEGER NOT NULL,
      mark_to INTEGER NOT NULL,
      mark_number INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS style_reports (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL UNIQUE REFERENCES articles(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return db;
}

// --- Users ---

export interface DbUser {
  id: number;
  username: string;
  password_hash: string;
}

export function getUserByUsername(username: string): DbUser | null {
  return (getDb()
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
    .get(username) as DbUser) ?? null;
}

export function createUser(username: string, passwordHash: string): { id: number; username: string } {
  const result = getDb()
    .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
    .run(username, passwordHash);
  const userId = result.lastInsertRowid as number;

  // Seed "The Last Leaf" for the new user
  const lastLeaf = sampleArticles.find((a) => a.id === "last-leaf");
  if (lastLeaf) {
    const articleId = `last-leaf-${userId}`;
    getDb()
      .prepare("INSERT INTO articles (id, user_id, title, author, content) VALUES (?, ?, ?, ?, ?)")
      .run(articleId, userId, lastLeaf.title, lastLeaf.author ?? null, lastLeaf.content);
  }

  return { id: userId, username };
}

// --- Articles ---

export function getAllArticles(userId: number): Article[] {
  return getDb()
    .prepare("SELECT id, title, author, content FROM articles WHERE user_id = ?")
    .all(userId) as Article[];
}

export function createArticle(userId: number, title: string, content: string, author?: string): Article {
  const id = `article-${Date.now()}`;
  getDb()
    .prepare("INSERT INTO articles (id, user_id, title, author, content) VALUES (?, ?, ?, ?, ?)")
    .run(id, userId, title, author ?? null, content);
  return { id, title, author, content };
}

export function getArticleOwner(articleId: string): number | null {
  const row = getDb()
    .prepare("SELECT user_id FROM articles WHERE id = ?")
    .get(articleId) as { user_id: number } | undefined;
  return row?.user_id ?? null;
}

export function deleteArticle(id: string): void {
  getDb().prepare("DELETE FROM articles WHERE id = ?").run(id);
}

export function updateArticle(id: string, title: string, content: string, author?: string): void {
  const db = getDb();
  db.prepare("UPDATE articles SET title = ?, author = ?, content = ? WHERE id = ?")
    .run(title, author ?? null, content, id);
  // Content may have changed — invalidate cached style report and annotations
  db.prepare("DELETE FROM style_reports WHERE article_id = ?").run(id);
  db.prepare("DELETE FROM annotations WHERE article_id = ?").run(id);
}

// --- Annotations ---

export interface StoredAnnotation {
  annotation: WordAnnotation | SentenceAnnotation;
  mark: { from: number; to: number; number: number; type: "word" | "sentence" };
}

export function getAnnotations(articleId: string): StoredAnnotation[] {
  const rows = getDb()
    .prepare("SELECT id, type, data, mark_from, mark_to, mark_number FROM annotations WHERE article_id = ?")
    .all(articleId) as { id: string; type: string; data: string; mark_from: number; mark_to: number; mark_number: number }[];

  return rows.map((row) => ({
    annotation: { ...JSON.parse(row.data), id: row.id, timestamp: new Date(JSON.parse(row.data).timestamp) },
    mark: { from: row.mark_from, to: row.mark_to, number: row.mark_number, type: row.type as "word" | "sentence" },
  }));
}

export function saveAnnotation(
  articleId: string,
  annotation: WordAnnotation | SentenceAnnotation,
  mark: { from: number; to: number; number: number }
): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO annotations (id, article_id, type, data, mark_from, mark_to, mark_number) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(annotation.id, articleId, annotation.type, JSON.stringify(annotation), mark.from, mark.to, mark.number);
}

export function deleteAnnotation(annotationId: string): void {
  getDb().prepare("DELETE FROM annotations WHERE id = ?").run(annotationId);
}

// --- Style Reports ---

export function getStyleReport(articleId: string): StyleReport | null {
  const row = getDb()
    .prepare("SELECT data FROM style_reports WHERE article_id = ?")
    .get(articleId) as { data: string } | undefined;

  if (!row) return null;
  const report = JSON.parse(row.data);
  return { ...report, timestamp: new Date(report.timestamp) };
}

export function saveStyleReport(articleId: string, report: StyleReport): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO style_reports (id, article_id, data) VALUES (?, ?, ?)")
    .run(report.id, articleId, JSON.stringify(report));
}
