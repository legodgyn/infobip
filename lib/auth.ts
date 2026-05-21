import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

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

  const users = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      email: string;
      role: "admin" | "client";
      clientId: string | null;
    }>
  >`
    SELECT "id", "name", "email", "role"::text AS "role", "clientId"
    FROM "User"
    WHERE "id" = ${payload.id}
    LIMIT 1
  `;

  return users[0] || null;
}
