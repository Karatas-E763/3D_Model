import { NextResponse } from "next/server";
import { applySessionCookie, validateCredentials } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { username, password } = (await request.json()) as {
      username?: string;
      password?: string;
    };

    const normalizedUser = username?.trim() ?? "";
    const normalizedPass = password?.trim() ?? "";

    if (!normalizedUser || !normalizedPass) {
      return NextResponse.json({ error: "Credenciales requeridas" }, { status: 400 });
    }

    if (!validateCredentials(normalizedUser, normalizedPass)) {
      return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, user: normalizedUser });
    return applySessionCookie(response, normalizedUser);
  } catch {
    return NextResponse.json({ error: "Error al iniciar sesión" }, { status: 500 });
  }
}
