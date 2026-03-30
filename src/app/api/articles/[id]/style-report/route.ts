import { NextRequest, NextResponse } from "next/server";
import { getStyleReport, saveStyleReport } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = getStyleReport(id);
  return NextResponse.json(report);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await req.json();
  saveStyleReport(id, report);
  return NextResponse.json({ ok: true });
}
