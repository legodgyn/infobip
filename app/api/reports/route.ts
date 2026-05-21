import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMessageWhere } from "@/lib/message-filters";
import { NextResponse } from "next/server";

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
    take: 1000,
  });

  return NextResponse.json(messages);
}
