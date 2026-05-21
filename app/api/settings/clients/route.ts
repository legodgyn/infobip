import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SettingsClientRow = {
  id: string;
  name: string;
  numbers: unknown;
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clients = await prisma.$queryRawUnsafe<SettingsClientRow[]>(`
      SELECT
        c."id",
        c."name",
        COALESCE(
          json_agg(
            json_build_object(
              'id', cn."id",
              'number', cn."number",
              'label', cn."label"
            )
            ORDER BY cn."createdAt" DESC
          ) FILTER (WHERE cn."id" IS NOT NULL),
          '[]'::json
        ) AS "numbers"
      FROM "Client" c
      LEFT JOIN "ClientNumber" cn ON cn."clientId" = c."id"
      GROUP BY c."id", c."name", c."createdAt"
      ORDER BY c."createdAt" DESC
    `);

    return NextResponse.json(clients);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os clientes.",
      },
      { status: 500 }
    );
  }
}
