import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type CountRow = {
  total: bigint | number | string;
  delivered: bigint | number | string;
  seen: bigint | number | string;
  failed: bigint | number | string;
  inbound: bigint | number | string;
};

function addFilters(
  filters: string[],
  values: unknown[],
  options: {
    clientId?: string;
    number?: string;
    start?: string;
    end?: string;
  }
) {
  if (options.clientId) {
    values.push(options.clientId);
    filters.push(`"clientId" = $${values.length}`);
  }

  if (options.start) {
    values.push(new Date(`${options.start}T00:00:00`));
    filters.push(`"createdAt" >= $${values.length}`);
  }

  if (options.end) {
    values.push(new Date(`${options.end}T23:59:59`));
    filters.push(`"createdAt" <= $${values.length}`);
  }

  const cleanNumber = options.number?.replace(/\D/g, "");
  if (cleanNumber) {
    values.push(cleanNumber);
    const index = values.length;
    filters.push(
      `regexp_replace(
        CASE
          WHEN "direction"::text = 'inbound' THEN "to"
          ELSE "from"
        END,
        '\\D',
        '',
        'g'
      ) LIKE '%' || $${index} || '%'`
    );
  }
}

function toNumber(value: bigint | number | string | null | undefined) {
  return Number(value || 0);
}

export async function GET(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const clientIdParam = searchParams.get("clientId") || undefined;
  const number = searchParams.get("number") || undefined;
  const start = searchParams.get("start") || undefined;
  const end = searchParams.get("end") || undefined;

  const clientId =
    user.role === "admin" ? clientIdParam : user.clientId || undefined;

  const filters: string[] = [];
  const values: unknown[] = [];
  addFilters(filters, values, { clientId, number, start, end });

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(
    `
      WITH scoped AS (
        SELECT *
        FROM "Message"
        ${where}
      ),
      flagged AS (
        SELECT
          m."id",
          m."direction"::text AS direction,
          m."deliveredAt",
          m."seenAt",
          m."failedAt",
          lower(COALESCE(m."status", '')) AS message_status,
          lower(COALESCE(string_agg(me."status", ' '), '')) AS event_status
        FROM scoped m
        LEFT JOIN "MessageEvent" me ON me."messageId" = m."id"
        GROUP BY
          m."id",
          m."direction",
          m."deliveredAt",
          m."seenAt",
          m."failedAt",
          m."status"
      )
      SELECT
        COUNT(*) FILTER (WHERE direction = 'outbound') AS total,
        COUNT(*) FILTER (
          WHERE direction = 'outbound'
            AND (
              "deliveredAt" IS NOT NULL
              OR message_status LIKE '%delivered%'
              OR message_status LIKE '%delivered_to_handset%'
              OR event_status LIKE '%delivered%'
              OR event_status LIKE '%delivered_to_handset%'
            )
        ) AS delivered,
        COUNT(*) FILTER (
          WHERE direction = 'outbound'
            AND (
              "seenAt" IS NOT NULL
              OR message_status LIKE '%seen%'
              OR message_status LIKE '%read%'
              OR event_status LIKE '%seen%'
              OR event_status LIKE '%read%'
            )
        ) AS seen,
        COUNT(*) FILTER (
          WHERE direction = 'outbound'
            AND (
              "failedAt" IS NOT NULL
              OR message_status LIKE '%failed%'
              OR message_status LIKE '%rejected%'
              OR message_status LIKE '%undeliverable%'
              OR message_status LIKE '%expired%'
              OR event_status LIKE '%failed%'
              OR event_status LIKE '%rejected%'
              OR event_status LIKE '%undeliverable%'
              OR event_status LIKE '%expired%'
            )
        ) AS failed,
        COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound
      FROM flagged
    `,
    ...values
  );

  const row = rows[0] || {};
  const total = toNumber(row.total);
  const delivered = toNumber(row.delivered);
  const seen = toNumber(row.seen);
  const failed = toNumber(row.failed);
  const inbound = toNumber(row.inbound);

  return NextResponse.json({
    total,
    delivered,
    seen,
    failed,
    inbound,
    deliveryRate: total ? Number(((delivered / total) * 100).toFixed(1)) : 0,
    seenRate: total ? Number(((seen / total) * 100).toFixed(1)) : 0,
    failureRate: total ? Number(((failed / total) * 100).toFixed(1)) : 0,
    responseRate: total ? Number(((inbound / total) * 100).toFixed(1)) : 0,
  });
}
