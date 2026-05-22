import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

type ChartRow = {
  name: string;
  enviados: bigint | number | string;
  entregues: bigint | number | string;
  lidas: bigint | number | string;
  falhas: bigint | number | string;
  respostas: bigint | number | string;
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
  const rows = await prisma.$queryRawUnsafe<ChartRow[]>(
    `
      WITH scoped AS (
        SELECT *
        FROM "Message"
        ${where}
      ),
      flagged AS (
        SELECT
          m."id",
          m."createdAt",
          m."direction"::text AS direction,
          m."deliveredAt",
          m."seenAt",
          m."failedAt",
          lower(COALESCE(m."status", '')) AS message_status,
          lower(COALESCE(string_agg(me."status", ' '), '')) AS event_status,
          lower(COALESCE(string_agg(me."raw"::text, ' '), '')) AS event_raw
        FROM scoped m
        LEFT JOIN "MessageEvent" me ON me."messageId" = m."id"
        GROUP BY
          m."id",
          m."createdAt",
          m."direction",
          m."deliveredAt",
          m."seenAt",
          m."failedAt",
          m."status"
      )
      SELECT
        to_char(date_trunc('day', "createdAt"), 'DD/MM') AS name,
        COUNT(*) FILTER (WHERE direction = 'outbound') AS enviados,
        COUNT(*) FILTER (
          WHERE direction = 'outbound'
            AND (
              "deliveredAt" IS NOT NULL
              OR message_status LIKE '%delivered%'
              OR message_status LIKE '%delivered_to_handset%'
              OR event_status LIKE '%delivered%'
              OR event_status LIKE '%delivered_to_handset%'
            )
        ) AS entregues,
        COUNT(*) FILTER (
          WHERE direction = 'outbound'
            AND (
              "seenAt" IS NOT NULL
              OR message_status LIKE '%seen%'
              OR message_status LIKE '%read%'
              OR event_status LIKE '%seen%'
              OR event_status LIKE '%read%'
              OR event_raw LIKE '%seen%'
              OR event_raw LIKE '%read%'
            )
        ) AS lidas,
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
        ) AS falhas,
        COUNT(*) FILTER (WHERE direction = 'inbound') AS respostas
      FROM flagged
      GROUP BY date_trunc('day', "createdAt")
      ORDER BY date_trunc('day', "createdAt") ASC
    `,
    ...values
  );

  return NextResponse.json(
    rows.map((row) => ({
      name: row.name,
      enviados: toNumber(row.enviados),
      entregues: toNumber(row.entregues),
      lidas: toNumber(row.lidas),
      falhas: toNumber(row.falhas),
      respostas: toNumber(row.respostas),
    }))
  );
}
