import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "troque_essa_chave";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "client";
  clientId?: string | null;
};

export function signToken(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  const payload = verifyToken(token);

  if (!payload?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      clientId: true,
    },
  });

  if (!user) return null;

  return user;
}