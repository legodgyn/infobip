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
  const rows = await prisma.$queryRawUnsafe<ChartRow[]>(
    `
      SELECT
        to_char(date_trunc('day', "createdAt"), 'DD/MM') AS name,
        COUNT(*) FILTER (WHERE "direction"::text = 'outbound') AS enviados,
        COUNT(*) FILTER (WHERE "direction"::text = 'outbound' AND "deliveredAt" IS NOT NULL) AS entregues,
        COUNT(*) FILTER (WHERE "direction"::text = 'outbound' AND "seenAt" IS NOT NULL) AS lidas,
        COUNT(*) FILTER (WHERE "direction"::text = 'outbound' AND "failedAt" IS NOT NULL) AS falhas,
        COUNT(*) FILTER (WHERE "direction"::text = 'inbound') AS respostas
      FROM "Message"
      ${where}
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
