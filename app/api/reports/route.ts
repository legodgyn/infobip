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
    include: {
      client: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  return NextResponse.json(messages);
}