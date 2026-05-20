import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

  const dateWhere =
    start || end
      ? {
          createdAt: {
            ...(start && { gte: new Date(`${start}T00:00:00`) }),
            ...(end && { lte: new Date(`${end}T23:59:59`) }),
          },
        }
      : {};

  const numberWhere = number
    ? {
        OR: [
          { from: { contains: number.replace(/\D/g, "") } },
          { to: { contains: number.replace(/\D/g, "") } },
        ],
      }
    : {};

  const baseWhere: any = {
    ...(clientId && { clientId }),
    ...dateWhere,
    ...numberWhere,
  };

  const total = await prisma.message.count({
    where: { ...baseWhere, direction: "outbound" },
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

  const inbound = await prisma.message.count({
    where: { ...baseWhere, direction: "inbound" },
  });

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
