import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  numbers: unknown;
  users: unknown;
  total: bigint | number | string;
  delivered: bigint | number | string;
  seen: bigint | number | string;
  failed: bigint | number | string;
  inbound: bigint | number | string;
};

function toNumber(value: bigint | number | string | null | undefined) {
  return Number(value || 0);
}

async function listClients(clientId?: string) {
  const where = clientId ? `WHERE c."id" = $1` : "";
  const values = clientId ? [clientId] : [];

  const rows = await prisma.$queryRawUnsafe<ClientRow[]>(
    `
      SELECT
        c."id",
        c."name",
        NULL::text AS "email",
        NULL::text AS "phone",
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', cn."id",
            'number', cn."number",
            'label', cn."label"
          )) FILTER (WHERE cn."id" IS NOT NULL),
          '[]'::json
        ) AS "numbers",
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', u."id",
            'name', u."name",
            'email', u."email",
            'role', u."role"::text
          )) FILTER (WHERE u."id" IS NOT NULL),
          '[]'::json
        ) AS "users",
        COUNT(DISTINCT m."id") FILTER (WHERE m."direction"::text = 'outbound') AS total,
        COUNT(DISTINCT m."id") FILTER (WHERE m."direction"::text = 'outbound' AND m."deliveredAt" IS NOT NULL) AS delivered,
        COUNT(DISTINCT m."id") FILTER (WHERE m."direction"::text = 'outbound' AND m."seenAt" IS NOT NULL) AS seen,
        COUNT(DISTINCT m."id") FILTER (WHERE m."direction"::text = 'outbound' AND m."failedAt" IS NOT NULL) AS failed,
        COUNT(DISTINCT m."id") FILTER (WHERE m."direction"::text = 'inbound') AS inbound
      FROM "Client" c
      LEFT JOIN "ClientNumber" cn ON cn."clientId" = c."id"
      LEFT JOIN "User" u ON u."clientId" = c."id"
      LEFT JOIN "Message" m ON m."clientId" = c."id"
      ${where}
      GROUP BY c."id", c."name", c."createdAt"
      ORDER BY c."createdAt" DESC
    `,
    ...values
  );

  return rows.map((row) => ({
    ...row,
    total: toNumber(row.total),
    delivered: toNumber(row.delivered),
    seen: toNumber(row.seen),
    failed: toNumber(row.failed),
    inbound: toNumber(row.inbound),
  }));
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role === "admin") {
    return NextResponse.json(await listClients());
  }

  if (!user.clientId) {
    return NextResponse.json([]);
  }

  return NextResponse.json(await listClients(user.clientId));
}
