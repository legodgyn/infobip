import { getCurrentUser } from "@/lib/auth";
import { normalizeSenderNumber } from "@/lib/infobip-senders";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type ImportNumber = {
  sender?: string;
  number?: string;
  displayName?: string | null;
  label?: string | null;
};

function getLabel(item: ImportNumber) {
  return item.displayName || item.label || null;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const clientId = String(body.clientId || "");
  const numbers = Array.isArray(body.numbers) ? (body.numbers as ImportNumber[]) : [];

  if (!clientId) {
    return NextResponse.json({ error: "Cliente obrigatorio." }, { status: 400 });
  }

  if (numbers.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um numero." }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let linkedMessages = 0;

  for (const item of numbers) {
    const number = normalizeSenderNumber(item.sender || item.number);

    if (!number) {
      skipped += 1;
      continue;
    }

    const label = getLabel(item);
    const existing = await prisma.clientNumber.findMany({
      where: { number },
      select: { id: true },
    });

    if (existing.length > 0) {
      await prisma.clientNumber.updateMany({
        where: { number },
        data: {
          clientId,
          label,
        },
      });
      updated += existing.length;
    } else {
      await prisma.clientNumber.create({
        data: {
          clientId,
          number,
          label,
        },
      });
      created += 1;
    }

    const linked = await prisma.message.updateMany({
      where: {
        OR: [{ from: { contains: number } }, { to: { contains: number } }],
      },
      data: { clientId },
    });

    linkedMessages += linked.count;
  }

  return NextResponse.json({
    success: true,
    created,
    updated,
    skipped,
    linkedMessages,
    message: `${created + updated} numero(s) vinculado(s) ao cliente.`,
  });
}
