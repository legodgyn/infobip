import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildMessageWhere } from "@/lib/message-filters";

export async function GET(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin" && !user.clientId) {
    return NextResponse.json({
      total: 0,
      delivered: 0,
      seen: 0,
      failed: 0,
      inbound: 0,
      deliveryRate: 0,
      seenRate: 0,
      failureRate: 0,
      responseRate: 0,
    });
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

  const baseWhere: any = buildMessageWhere({
    clientId,
    number,
    numbers: clientNumbers.map((item) => item.number),
    start,
    end,
  });

  const outbound = await prisma.message.count({
    where: { ...baseWhere, direction: "outbound" },
  });

  const inbound = await prisma.message.count({
    where: { ...baseWhere, direction: "inbound" },
  });

  const delivered = await prisma.message.count({
    where: { ...baseWhere, direction: "outbound", deliveredAt: { not: null } },
  });

  const seen = await prisma.message.count({
    where: { ...baseWhere, direction: "outbound", seenAt: { not: null } },
  });

  const failed = await prisma.message.count({
    where: { ...baseWhere, direction: "outbound", failedAt: { not: null } },
  });

  const lastMessage = await prisma.message.findFirst({
    where: baseWhere,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      direction: true,
      from: true,
      to: true,
      text: true,
      status: true,
      createdAt: true,
      receivedAt: true,
      sentAt: true,
    },
  });

  const lastWebhookHit = await prisma.appSetting.findUnique({
    where: { key: "infobip.webhook.lastHit" },
    select: { value: true },
  });

  const total = outbound + inbound;

  return NextResponse.json({
    total,
    outbound,
    delivered,
    seen,
    failed,
    inbound,
    lastMessage,
    lastWebhookAt: lastWebhookHit?.value || null,
    deliveryRate: outbound ? Number(((delivered / outbound) * 100).toFixed(1)) : 0,
    seenRate: outbound ? Number(((seen / outbound) * 100).toFixed(1)) : 0,
    failureRate: outbound ? Number(((failed / outbound) * 100).toFixed(1)) : 0,
    responseRate: total ? Number(((inbound / total) * 100).toFixed(1)) : 0,
  });
}
