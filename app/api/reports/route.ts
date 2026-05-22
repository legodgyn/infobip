import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

type ReportRow = {
  id: string;
  infobipMsgId: string | null;
  clientId: string | null;
  from: string;
  to: string;
  text: string | null;
  direction: string;
  status: string | null;
  createdAt: Date;
  sentAt: Date | null;
  receivedAt: Date | null;
  deliveredAt: Date | null;
  seenAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  raw: unknown;
  client: { id: string; name: string } | null;
};

function businessNumberExpression() {
  return `regexp_replace(
    CASE
      WHEN lower(m."direction"::text) = 'inbound' THEN m."to"
      ELSE m."from"
    END,
    '\\D',
    '',
    'g'
  )`;
}

function statusFilter(status: string, index: number) {
  return `
    (
      lower(COALESCE(m."status", '')) LIKE '%' || $${index} || '%'
      OR EXISTS (
        SELECT 1
        FROM "MessageEvent" me
        WHERE me."messageId" = m."id"
          AND (
            lower(COALESCE(me."status", '')) LIKE '%' || $${index} || '%'
            OR lower(COALESCE(me."raw"::text, '')) LIKE '%' || $${index} || '%'
            OR (
              $${index} IN ('seen', 'read')
              AND (
                lower(COALESCE(me."status", '')) LIKE '%seen%'
                OR lower(COALESCE(me."status", '')) LIKE '%read%'
                OR lower(COALESCE(me."raw"::text, '')) LIKE '%seen%'
                OR lower(COALESCE(me."raw"::text, '')) LIKE '%read%'
              )
            )
          )
      )
      OR (
        $${index} = 'delivered'
        AND m."deliveredAt" IS NOT NULL
      )
      OR (
        $${index} IN ('seen', 'read')
        AND m."seenAt" IS NOT NULL
      )
      OR (
        $${index} IN ('failed', 'rejected', 'undeliverable', 'expired')
        AND m."failedAt" IS NOT NULL
      )
    )
  `;
}

function addScopedFilters(
  filters: string[],
  values: unknown[],
  options: {
    clientId?: string;
    number?: string;
    status?: string;
    start?: string | null;
    end?: string | null;
  }
) {
  const businessNumber = businessNumberExpression();

  if (options.clientId) {
    values.push(options.clientId);
    const index = values.length;
    filters.push(`
      EXISTS (
        SELECT 1
        FROM "ClientNumber" cn
        WHERE cn."clientId" = $${index}
          AND (
            ${businessNumber} = regexp_replace(cn."number", '\\D', '', 'g')
            OR ${businessNumber} LIKE '%' || regexp_replace(cn."number", '\\D', '', 'g')
            OR regexp_replace(cn."number", '\\D', '', 'g') LIKE '%' || ${businessNumber}
          )
      )
    `);
  } else {
    filters.push(`
      EXISTS (
        SELECT 1
        FROM "ClientNumber" cn
        WHERE ${businessNumber} = regexp_replace(cn."number", '\\D', '', 'g')
          OR ${businessNumber} LIKE '%' || regexp_replace(cn."number", '\\D', '', 'g')
          OR regexp_replace(cn."number", '\\D', '', 'g') LIKE '%' || ${businessNumber}
      )
    `);
  }

  const cleanNumber = options.number?.replace(/\D/g, "");
  if (cleanNumber) {
    values.push(cleanNumber);
    const index = values.length;
    filters.push(`${businessNumber} LIKE '%' || $${index} || '%'`);
  }

  if (options.status && options.status !== "all") {
    values.push(options.status.toLowerCase());
    const index = values.length;
    filters.push(statusFilter(options.status.toLowerCase(), index));
  }

  if (options.start) {
    values.push(new Date(`${options.start}T00:00:00`));
    filters.push(`m."createdAt" >= $${values.length}`);
  }

  if (options.end) {
    values.push(new Date(`${options.end}T23:59:59`));
    filters.push(`m."createdAt" <= $${values.length}`);
  }
}

export async function GET(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const clientIdParam = searchParams.get("clientId") || undefined;
  const number = searchParams.get("number") || undefined;
  const status = searchParams.get("status") || undefined;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const clientId =
    user.role === "admin" ? clientIdParam : user.clientId || undefined;

  const filters: string[] = [];
  const values: unknown[] = [];
  addScopedFilters(filters, values, { clientId, number, status, start, end });

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const messages = await prisma.$queryRawUnsafe<ReportRow[]>(
    `
      SELECT
        m."id",
        m."infobipMsgId",
        m."clientId",
        m."from",
        m."to",
        m."text",
        m."direction"::text AS "direction",
        CASE
          WHEN m."seenAt" IS NOT NULL
            OR EXISTS (
              SELECT 1
              FROM "MessageEvent" me
              WHERE me."messageId" = m."id"
                AND (
                  lower(COALESCE(me."status", '')) LIKE '%seen%'
                  OR lower(COALESCE(me."status", '')) LIKE '%read%'
                  OR lower(COALESCE(me."raw"::text, '')) LIKE '%seen%'
                  OR lower(COALESCE(me."raw"::text, '')) LIKE '%read%'
                )
            )
            THEN 'READ'
          WHEN m."failedAt" IS NOT NULL THEN 'FAILED'
          WHEN m."deliveredAt" IS NOT NULL THEN 'DELIVERED'
          ELSE m."status"
        END AS "status",
        m."createdAt",
        m."sentAt",
        m."receivedAt",
        m."deliveredAt",
        m."seenAt",
        m."failedAt",
        m."failureReason",
        m."raw",
        CASE
          WHEN c."id" IS NULL THEN NULL
          ELSE json_build_object('id', c."id", 'name', c."name")
        END AS "client"
      FROM "Message" m
      LEFT JOIN "Client" c ON c."id" = m."clientId"
      ${where}
      ORDER BY m."createdAt" DESC
      LIMIT 1000
    `,
    ...values
  );

  return NextResponse.json(messages);
}
