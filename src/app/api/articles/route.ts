import { NextResponse } from "next/server";
import { getAllArticles } from "@/lib/db";

export async function GET() {
  const articles = getAllArticles();
  return NextResponse.json(articles);
}
