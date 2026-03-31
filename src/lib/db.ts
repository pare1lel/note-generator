import { createClient, type Client } from "@libsql/client";
import { sampleArticles } from "./articles";
import type { Article, WordAnnotation, SentenceAnnotation, StyleReport } from "./types";

let client: Client | null = null;
let initPromise: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL ?? "file:data/notes.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

async function db(): Promise<Client> {
  const c = getClient();
  if (!initPromise) {
    initPromise = (async () => {
      await c.execute("PRAGMA foreign_keys = ON");
      await c.executeMultiple(`
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
    })();
  }
  await initPromise;
  return c;
}

// --- Users ---

export interface DbUser {
  id: number;
  username: string;
  password_hash: string;
}

export async function getUserByUsername(username: string): Promise<DbUser | null> {
  const c = await db();
  const result = await c.execute({
    sql: "SELECT id, username, password_hash FROM users WHERE username = ?",
    args: [username],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: Number(row.id),
    username: row.username as string,
    password_hash: row.password_hash as string,
  };
}

export async function createUser(username: string, passwordHash: string): Promise<{ id: number; username: string }> {
  const c = await db();
  const result = await c.execute({
    sql: "INSERT INTO users (username, password_hash) VALUES (?, ?)",
    args: [username, passwordHash],
  });
  const userId = Number(result.lastInsertRowid);

  // Seed "The Last Leaf" for the new user
  const lastLeaf = sampleArticles.find((a) => a.id === "last-leaf");
  if (lastLeaf) {
    const articleId = `last-leaf-${userId}`;
    await c.execute({
      sql: "INSERT INTO articles (id, user_id, title, author, content) VALUES (?, ?, ?, ?, ?)",
      args: [articleId, userId, lastLeaf.title, lastLeaf.author ?? null, lastLeaf.content],
    });
  }

  return { id: userId, username };
}

// --- Articles ---

export async function getAllArticles(userId: number): Promise<Article[]> {
  const c = await db();
  const result = await c.execute({
    sql: "SELECT id, title, author, content FROM articles WHERE user_id = ?",
    args: [userId],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    author: (row.author as string) || undefined,
    content: row.content as string,
  }));
}

export async function createArticle(userId: number, title: string, content: string, author?: string): Promise<Article> {
  const c = await db();
  const id = `article-${Date.now()}`;
  await c.execute({
    sql: "INSERT INTO articles (id, user_id, title, author, content) VALUES (?, ?, ?, ?, ?)",
    args: [id, userId, title, author ?? null, content],
  });
  return { id, title, author, content };
}

export async function getArticleOwner(articleId: string): Promise<number | null> {
  const c = await db();
  const result = await c.execute({
    sql: "SELECT user_id FROM articles WHERE id = ?",
    args: [articleId],
  });
  if (result.rows.length === 0) return null;
  return Number(result.rows[0].user_id);
}

export async function deleteArticle(id: string): Promise<void> {
  const c = await db();
  await c.execute({ sql: "DELETE FROM articles WHERE id = ?", args: [id] });
}

export async function updateArticle(id: string, title: string, content: string, author?: string): Promise<void> {
  const c = await db();
  await c.batch([
    { sql: "UPDATE articles SET title = ?, author = ?, content = ? WHERE id = ?", args: [title, author ?? null, content, id] },
    { sql: "DELETE FROM style_reports WHERE article_id = ?", args: [id] },
    { sql: "DELETE FROM annotations WHERE article_id = ?", args: [id] },
  ], "write");
}

// --- Annotations ---

export interface StoredAnnotation {
  annotation: WordAnnotation | SentenceAnnotation;
  mark: { from: number; to: number; number: number; type: "word" | "sentence" };
}

export async function getAnnotations(articleId: string): Promise<StoredAnnotation[]> {
  const c = await db();
  const result = await c.execute({
    sql: "SELECT id, type, data, mark_from, mark_to, mark_number FROM annotations WHERE article_id = ?",
    args: [articleId],
  });

  return result.rows.map((row) => ({
    annotation: {
      ...JSON.parse(row.data as string),
      id: row.id as string,
      timestamp: new Date(JSON.parse(row.data as string).timestamp),
    },
    mark: {
      from: Number(row.mark_from),
      to: Number(row.mark_to),
      number: Number(row.mark_number),
      type: row.type as "word" | "sentence",
    },
  }));
}

export async function saveAnnotation(
  articleId: string,
  annotation: WordAnnotation | SentenceAnnotation,
  mark: { from: number; to: number; number: number }
): Promise<void> {
  const c = await db();
  await c.execute({
    sql: "INSERT OR REPLACE INTO annotations (id, article_id, type, data, mark_from, mark_to, mark_number) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [annotation.id, articleId, annotation.type, JSON.stringify(annotation), mark.from, mark.to, mark.number],
  });
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  const c = await db();
  await c.execute({ sql: "DELETE FROM annotations WHERE id = ?", args: [annotationId] });
}

// --- Style Reports ---

export async function getStyleReport(articleId: string): Promise<StyleReport | null> {
  const c = await db();
  const result = await c.execute({
    sql: "SELECT data FROM style_reports WHERE article_id = ?",
    args: [articleId],
  });

  if (result.rows.length === 0) return null;
  const report = JSON.parse(result.rows[0].data as string);
  return { ...report, timestamp: new Date(report.timestamp) };
}

export async function saveStyleReport(articleId: string, report: StyleReport): Promise<void> {
  const c = await db();
  await c.execute({
    sql: "INSERT OR REPLACE INTO style_reports (id, article_id, data) VALUES (?, ?, ?)",
    args: [report.id, articleId, JSON.stringify(report)],
  });
}
