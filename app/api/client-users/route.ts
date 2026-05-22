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

export async function PUT(req: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const id = String(body.id || "").trim();
  const email = String(body.email || "").toLowerCase().trim();
  const name = String(body.name || "").trim();
  const clientId = String(body.clientId || "").trim();
  const password = String(body.password || "").trim();

  if (!id || !name || !email || !clientId) {
    return NextResponse.json(
      { error: "ID, nome, e-mail e cliente sao obrigatorios." },
      { status: 400 }
    );
  }

  const existing = await prisma.$queryRaw<CreatedUser[]>`
    SELECT "id", "name", "email", "role"::text AS "role", "clientId"
    FROM "User"
    WHERE "id" = ${id} AND "role"::text = 'client'
    LIMIT 1
  `;

  if (!existing[0]) {
    return NextResponse.json(
      { error: "Usuario de cliente nao encontrado." },
      { status: 404 }
    );
  }

  const updated = password
    ? await prisma.$queryRaw<CreatedUser[]>`
        UPDATE "User"
        SET
          "name" = ${name},
          "email" = ${email},
          "password" = ${await bcrypt.hash(password, 10)},
          "clientId" = ${clientId}
        WHERE "id" = ${id} AND "role"::text = 'client'
        RETURNING "id", "name", "email", "role"::text AS "role", "clientId"
      `
    : await prisma.$queryRaw<CreatedUser[]>`
        UPDATE "User"
        SET
          "name" = ${name},
          "email" = ${email},
          "clientId" = ${clientId}
        WHERE "id" = ${id} AND "role"::text = 'client'
        RETURNING "id", "name", "email", "role"::text AS "role", "clientId"
      `;

  return NextResponse.json(updated[0]);
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "").trim();

  if (!id) {
    return NextResponse.json({ error: "ID obrigatorio." }, { status: 400 });
  }

  const deleted = await prisma.$queryRaw<{ id: string }[]>`
    DELETE FROM "User"
    WHERE "id" = ${id} AND "role"::text = 'client'
    RETURNING "id"
  `;

  if (!deleted[0]) {
    return NextResponse.json(
      { error: "Usuario de cliente nao encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
