import { NextRequest, NextResponse } from "next/server";
import { getAnnotations, saveAnnotation, deleteAnnotation } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = getAnnotations(id);
  return NextResponse.json(stored);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { annotation, mark } = await req.json();
  saveAnnotation(id, annotation, mark);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { annotationId } = await req.json();
  deleteAnnotation(annotationId);
  return NextResponse.json({ ok: true });
}
