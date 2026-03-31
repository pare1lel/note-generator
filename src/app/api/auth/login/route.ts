import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByUsername } from "@/lib/db";
import { signToken, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const user = await getUserByUsername(username?.trim().toLowerCase() ?? "");
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signToken({ userId: user.id, username: user.username });
  const res = NextResponse.json({ username: user.username });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
