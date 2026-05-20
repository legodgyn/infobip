import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function cleanText(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

async function withClientStats(clients: any[]) {
  return Promise.all(
    clients.map(async (client) => {
      const where = { clientId: client.id };

      const [total, delivered, seen, failed, inbound] = await Promise.all([
        prisma.message.count({ where: { ...where, direction: "outbound" } }),
        prisma.message.count({
          where: { ...where, direction: "outbound", deliveredAt: { not: null } },
        }),
        prisma.message.count({
          where: { ...where, direction: "outbound", seenAt: { not: null } },
        }),
        prisma.message.count({
          where: { ...where, direction: "outbound", failedAt: { not: null } },
        }),
        prisma.message.count({ where: { ...where, direction: "inbound" } }),
      ]);

      return {
        ...client,
        total,
        delivered,
        seen,
        failed,
        inbound,
        deliveryRate: total ? Number(((delivered / total) * 100).toFixed(1)) : 0,
        seenRate: total ? Number(((seen / total) * 100).toFixed(1)) : 0,
      };
    })
  );
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role === "admin") {
    const clients = await prisma.client.findMany({
      include: {
        numbers: { orderBy: { createdAt: "desc" } },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            clientId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(await withClientStats(clients));
  }

  if (!user.clientId) {
    return NextResponse.json([]);
  }

  const client = await prisma.client.findUnique({
    where: {
      id: user.clientId,
    },
    include: {
      numbers: { orderBy: { createdAt: "desc" } },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          clientId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json(client ? await withClientStats([client]) : []);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = cleanText(body.name);

  if (!name) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: {
      name,
      email: cleanText(body.email),
      phone: cleanText(body.phone),
    },
    include: {
      numbers: true,
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          clientId: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json(client, { status: 201 });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const id = cleanText(body.id);
  const name = cleanText(body.name);

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const client = await prisma.client.update({
    where: { id },
    data: {
      name,
      email: cleanText(body.email),
      phone: cleanText(body.phone),
    },
    include: {
      numbers: true,
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          clientId: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json(client);
}
