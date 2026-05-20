import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const body = await req.json();

  const email = String(body.email || "").toLowerCase().trim();
  const password = String(body.password || "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "E-mail e senha são obrigatórios" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Login inválido" },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return NextResponse.json(
      { error: "Login inválido" },
      { status: 401 }
    );
  }

  const token = signToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as "admin" | "client",
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
}