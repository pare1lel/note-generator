import { NextRequest, NextResponse } from "next/server";
import { updateArticle, deleteArticle, getArticleOwner } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

async function verifyOwnership(req: NextRequest, articleId: string) {
  const session = await getSessionFromRequest(req);
  if (!session) return null;
  const owner = await getArticleOwner(articleId);
  if (owner !== session.userId) return null;
  return session;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await verifyOwnership(req, id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, content, author } = await req.json();
  await updateArticle(id, title, content, author);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await verifyOwnership(req, id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteArticle(id);
  return NextResponse.json({ ok: true });
}
