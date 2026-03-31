import { NextRequest, NextResponse } from "next/server";
import { updateArticle, deleteArticle } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { title, content, author } = await req.json();
  updateArticle(id, title, content, author);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteArticle(id);
  return NextResponse.json({ ok: true });
}
