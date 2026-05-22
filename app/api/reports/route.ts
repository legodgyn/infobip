import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
    take: 1000,
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

  return NextResponse.json(
    messages.map((message) => ({
      ...message,
      client: message.clientId ? clientById.get(message.clientId) || null : null,
    }))
  );
}
