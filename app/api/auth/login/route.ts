import { signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

type LoginUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "client";
  clientId: string | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mail e senha sao obrigatorios" },
        { status: 400 }
      );
    }

    const users = await prisma.$queryRaw<LoginUser[]>`
      SELECT "id", "name", "email", "password", "role"::text AS "role", "clientId"
      FROM "User"
      WHERE "email" = ${email}
      LIMIT 1
    `;
    const user = users[0];

    if (!user) {
      return NextResponse.json({ error: "Login invalido" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return NextResponse.json({ error: "Login invalido" }, { status: 401 });
    }

    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
    });

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clientId: user.clientId,
      },
    });

    res.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (error) {
    console.error("ERRO LOGIN:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao fazer login.",
      },
      { status: 500 }
    );
  }
}
