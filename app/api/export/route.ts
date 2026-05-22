import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function safe(value: any) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

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
    filters.push(`lower(COALESCE(m."status", '')) LIKE '%' || $${index} || '%'`);
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
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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

  const messages = await prisma.$queryRawUnsafe<
    Array<{
      clientName: string | null;
      direction: string;
      from: string;
      to: string;
      status: string | null;
      text: string | null;
      createdAt: Date | null;
      deliveredAt: Date | null;
      seenAt: Date | null;
      failedAt: Date | null;
      failureReason: string | null;
    }>
  >(
    `
      SELECT
        c."name" AS "clientName",
        m."direction"::text AS "direction",
        m."from",
        m."to",
        m."status",
        m."text",
        m."createdAt",
        m."deliveredAt",
        m."seenAt",
        m."failedAt",
        m."failureReason"
      FROM "Message" m
      LEFT JOIN "Client" c ON c."id" = m."clientId"
      ${where}
      ORDER BY m."createdAt" DESC
      LIMIT 5000
    `,
    ...values
  );

  const csv = [
    [
      "Cliente",
      "Direcao",
      "De",
      "Para",
      "Status",
      "Texto",
      "Criado em",
      "Entregue em",
      "Lido em",
      "Falhou em",
      "Motivo da falha",
    ].map(safe).join(","),

    ...messages.map((m) =>
      [
        m.clientName,
        m.direction,
        m.from,
        m.to,
        m.status,
        m.text,
        m.createdAt?.toISOString(),
        m.deliveredAt?.toISOString(),
        m.seenAt?.toISOString(),
        m.failedAt?.toISOString(),
        m.failureReason,
      ].map(safe).join(",")
    ),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=relatorio-infobip.csv`,
    },
  });
}
