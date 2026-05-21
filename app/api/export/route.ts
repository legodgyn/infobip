import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMessageWhere } from "@/lib/message-filters";
import { NextResponse } from "next/server";

function safe(value: any) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin" && !user.clientId) {
    return new Response("", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=relatorio-infobip.csv",
      },
    });
  }

  const { searchParams } = new URL(req.url);

  const clientIdParam = searchParams.get("clientId") || undefined;
  const status = searchParams.get("status") || undefined;
  const number = searchParams.get("number") || undefined;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const clientId =
    user.role === "admin" ? clientIdParam : user.clientId || undefined;

  const clientNumbers = clientId
    ? await prisma.clientNumber.findMany({
        where: { clientId },
        select: { number: true },
      })
    : [];

  const where: any = buildMessageWhere({
    clientId,
    number,
    numbers: clientNumbers.map((item) => item.number),
    start,
    end,
    status,
  });

  const messages = await prisma.message.findMany({
    where,
    include: {
      client: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

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
        m.client?.name,
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
      "Content-Disposition": "attachment; filename=relatorio-infobip.csv",
    },
  });
}
