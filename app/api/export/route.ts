import { prisma } from "@/lib/prisma";

function safe(value: any) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const clientId = searchParams.get("clientId") || undefined;
  const status = searchParams.get("status") || undefined;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const where: any = {
    ...(clientId && { clientId }),
    ...(status && status !== "all" && { status: { contains: status, mode: "insensitive" } }),
    ...(start &&
      end && {
        createdAt: {
          gte: new Date(start),
          lte: new Date(end),
        },
      }),
  };

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const clientIds = Array.from(
    new Set(messages.map((message) => message.clientId).filter(Boolean))
  ) as string[];

  const clients =
    clientIds.length > 0
      ? await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
          `
            SELECT "id", "name"
            FROM "Client"
            WHERE "id" = ANY($1)
          `,
          clientIds
        )
      : [];

  const clientById = new Map(clients.map((client) => [client.id, client]));

  const csv = [
    [
      "Cliente",
      "Direção",
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
        m.clientId ? clientById.get(m.clientId)?.name : null,
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
