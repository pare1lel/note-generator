import { NextRequest, NextResponse } from "next/server";
import { getQAs, saveQA, getArticleOwner } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

async function verifyOwnership(req: NextRequest, articleId: string) {
  const session = await getSessionFromRequest(req);
  if (!session) return null;
  const owner = await getArticleOwner(articleId);
  if (owner !== session.userId) return null;
  return session;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await verifyOwnership(req, id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getQAs(id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await verifyOwnership(req, id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { qa } = await req.json();
  await saveQA(id, qa);
  return NextResponse.json({ ok: true });
}
