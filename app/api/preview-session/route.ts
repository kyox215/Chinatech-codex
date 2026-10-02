import { NextResponse } from "next/server";
import {
  isPreviewLoginAvailable,
  PREVIEW_EMAIL,
  PREVIEW_PASSWORD,
  PREVIEW_SESSION_COOKIE,
  PREVIEW_SESSION_VALUE,
} from "@/lib/preview-auth";

export async function POST(request: Request) {
  if (!isPreviewLoginAvailable()) {
    return NextResponse.json({ message: "本地预览登录未开放。" }, { status: 404 });
  }

  let credentials: { email?: string; password?: string };

  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ message: "请求格式无效。" }, { status: 400 });
  }

  if (credentials.email?.trim().toLowerCase() !== PREVIEW_EMAIL || credentials.password !== PREVIEW_PASSWORD) {
    return NextResponse.json({ message: "演示邮箱或密码不正确。" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(PREVIEW_SESSION_COOKIE, PREVIEW_SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PREVIEW_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
