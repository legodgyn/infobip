import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const where: any = {
    ...(clientId && { clientId }),
    ...(number
      ? {
          OR: [
            { from: { contains: number.replace(/\D/g, "") } },
            { to: { contains: number.replace(/\D/g, "") } },
          ],
        }
      : {}),
    ...(status &&
      status !== "all" && {
        status: { contains: status, mode: "insensitive" },
      }),
    ...(start || end
      ? {
          createdAt: {
            ...(start && { gte: new Date(`${start}T00:00:00`) }),
            ...(end && { lte: new Date(`${end}T23:59:59`) }),
          },
        }
      : {}),
  };

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
