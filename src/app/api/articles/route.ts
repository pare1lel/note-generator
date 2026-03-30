import { NextRequest, NextResponse } from "next/server";
import { getAllArticles, createArticle } from "@/lib/db";

export async function GET() {
  const articles = getAllArticles();
  return NextResponse.json(articles);
}

export async function POST(req: NextRequest) {
  const { title, content, author } = await req.json();
  const article = createArticle(title, content, author);
  return NextResponse.json(article);
}
