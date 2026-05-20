import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where =
    user.role === "admin"
      ? {}
      : {
          clientId: user.clientId || "__NO_CLIENT__",
        };

  const [messagesTotal, eventsTotal, numbersTotal, lastMessages, lastEvents] =
    await Promise.all([
      prisma.message.count({ where }),
      prisma.messageEvent.count(),
      prisma.clientNumber.count(),
      prisma.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          infobipMsgId: true,
          clientId: true,
          from: true,
          to: true,
          direction: true,
          text: true,
          status: true,
          createdAt: true,
          receivedAt: true,
          sentAt: true,
        },
      }),
      prisma.messageEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          messageId: true,
          infobipMsgId: true,
          status: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

  return NextResponse.json({
    messagesTotal,
    eventsTotal,
    numbersTotal,
    lastMessages,
    lastEvents,
  });
}
