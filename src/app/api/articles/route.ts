import { NextRequest, NextResponse } from "next/server";
import { getAllArticles, createArticle } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const articles = getAllArticles(session.userId);
  return NextResponse.json(articles);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, content, author } = await req.json();
  const article = createArticle(session.userId, title, content, author);
  return NextResponse.json(article);
}
