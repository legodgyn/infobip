import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { buildMessageWhere } from "@/lib/message-filters";

export async function GET(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin" && !user.clientId) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(req.url);

  const clientIdParam = searchParams.get("clientId") || undefined;
  const number = searchParams.get("number") || undefined;
  const start = searchParams.get("start") || undefined;
  const end = searchParams.get("end") || undefined;

  const clientId =
    user.role === "admin" ? clientIdParam : user.clientId || undefined;

  const clientNumbers = clientId
    ? await prisma.clientNumber.findMany({
        where: { clientId },
        select: { number: true },
      })
    : [];

  const messages = await prisma.message.findMany({
    where: buildMessageWhere({
      clientId,
      number,
      numbers: clientNumbers.map((item) => item.number),
      start,
      end,
    }),
    orderBy: { createdAt: "asc" },
  });

  const grouped: Record<string, any> = {};

  for (const msg of messages) {
    const key = format(new Date(msg.createdAt), "dd/MM");

    if (!grouped[key]) {
      grouped[key] = {
        name: key,
        enviados: 0,
        entregues: 0,
        lidas: 0,
        falhas: 0,
        respostas: 0,
      };
    }

    if (msg.direction === "inbound") {
      grouped[key].respostas++;
    } else {
      grouped[key].enviados++;
    }

    if (msg.deliveredAt) grouped[key].entregues++;
    if (msg.seenAt) grouped[key].lidas++;
    if (msg.failedAt) grouped[key].falhas++;
  }

  return NextResponse.json(Object.values(grouped));
}
