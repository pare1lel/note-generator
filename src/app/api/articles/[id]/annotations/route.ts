import { NextRequest, NextResponse } from "next/server";
import { getAnnotations, saveAnnotation, deleteAnnotation, getArticleOwner } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

async function verifyOwnership(req: NextRequest, articleId: string) {
  const session = await getSessionFromRequest(req);
  if (!session) return null;
  const owner = getArticleOwner(articleId);
  if (owner !== session.userId) return null;
  return session;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await verifyOwnership(req, id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getAnnotations(id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await verifyOwnership(req, id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { annotation, mark } = await req.json();
  saveAnnotation(id, annotation, mark);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await verifyOwnership(req, id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { annotationId } = await req.json();
  deleteAnnotation(annotationId);
  return NextResponse.json({ ok: true });
}
