import { NextRequest, NextResponse } from "next/server";
import { deleteQA, getArticleOwner } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

async function verifyOwnership(req: NextRequest, articleId: string) {
  const session = await getSessionFromRequest(req);
  if (!session) return null;
  const owner = await getArticleOwner(articleId);
  if (owner !== session.userId) return null;
  return session;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; qaId: string }> }) {
  const { id, qaId } = await params;
  if (!await verifyOwnership(req, id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteQA(qaId);
  return NextResponse.json({ ok: true });
}
