import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, getUserByUsername } from "@/lib/db";
import { signToken, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username?.trim() || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Username and password (min 6 chars) are required" },
      { status: 400 }
    );
  }

  const normalized = username.trim().toLowerCase();
  const existing = getUserByUsername(normalized);
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = createUser(normalized, hash);

  const token = await signToken({ userId: user.id, username: user.username });
  const res = NextResponse.json({ username: user.username });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
