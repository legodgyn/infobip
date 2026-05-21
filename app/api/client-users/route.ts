import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

type CreatedUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "client";
  clientId: string | null;
};

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const password = String(body.password || "123456");
  const hashedPassword = await bcrypt.hash(password, 10);
  const email = String(body.email || "").toLowerCase().trim();
  const name = String(body.name || "").trim();
  const clientId = String(body.clientId || "");

  if (!name || !email || !clientId) {
    return NextResponse.json(
      { error: "Nome, e-mail e cliente sao obrigatorios." },
      { status: 400 }
    );
  }

  const created = await prisma.$queryRaw<CreatedUser[]>`
    INSERT INTO "User" ("id", "name", "email", "password", "role", "clientId", "createdAt")
    VALUES (
      'usr_' || replace(gen_random_uuid()::text, '-', ''),
      ${name},
      ${email},
      ${hashedPassword},
      'client',
      ${clientId},
      now()
    )
    ON CONFLICT ("email")
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "password" = EXCLUDED."password",
      "role" = EXCLUDED."role",
      "clientId" = EXCLUDED."clientId"
    RETURNING "id", "name", "email", "role"::text AS "role", "clientId"
  `;

  return NextResponse.json(created[0]);
}
