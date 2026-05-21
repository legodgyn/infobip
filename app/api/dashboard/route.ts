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
      `(regexp_replace("from", '\\D', '', 'g') LIKE '%' || $${index} || '%' OR regexp_replace("to", '\\D', '', 'g') LIKE '%' || $${index} || '%')`
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
      SELECT
        COUNT(*) FILTER (WHERE "direction"::text = 'outbound') AS total,
        COUNT(*) FILTER (WHERE "direction"::text = 'outbound' AND "deliveredAt" IS NOT NULL) AS delivered,
        COUNT(*) FILTER (WHERE "direction"::text = 'outbound' AND "seenAt" IS NOT NULL) AS seen,
        COUNT(*) FILTER (WHERE "direction"::text = 'outbound' AND "failedAt" IS NOT NULL) AS failed,
        COUNT(*) FILTER (WHERE "direction"::text = 'inbound') AS inbound
      FROM "Message"
      ${where}
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
