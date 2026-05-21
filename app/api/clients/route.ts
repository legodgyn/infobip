import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role === "admin") {
    const clients = await prisma.client.findMany({
      include: {
        numbers: true,
        users: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(clients);
  }

  if (!user.clientId) {
    return NextResponse.json([]);
  }

  const client = await prisma.client.findUnique({
    where: {
      id: user.clientId,
    },
    include: {
      numbers: true,
      users: true,
    },
  });

  return NextResponse.json(client ? [client] : []);
}
