import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function matchesPhone(a?: string | null, b?: string | null) {
  const left = normalizePhone(a);
  const right = normalizePhone(b);

  if (!left || !right) return false;

  return left === right || left.endsWith(right) || right.endsWith(left);
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientNumbers = await prisma.clientNumber.findMany({
    where:
      user.role === "admin"
        ? undefined
        : {
            clientId: user.clientId || "__NO_CLIENT__",
          },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const userNumbers = clientNumbers
    .map((item) => normalizePhone(item.number))
    .filter(Boolean);

  const numberMatches = userNumbers.flatMap((number) => [
    { from: { contains: number } },
    { to: { contains: number } },
  ]);

  const where =
    user.role === "admin"
      ? {}
      : {
          OR: [
            { clientId: user.clientId || "__NO_CLIENT__" },
            ...numberMatches,
          ],
        };

  const messages = await prisma.message.findMany({
    where,
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const conversationsMap = new Map<string, any>();

  for (const msg of messages) {
    const contact = msg.direction === "inbound" ? msg.from : msg.to;
    const businessNumber = msg.direction === "inbound" ? msg.to : msg.from;

    if (!contact) continue;

    const matchedNumber = clientNumbers.find((item) =>
      matchesPhone(item.number, businessNumber)
    );

    const clientId = msg.clientId || matchedNumber?.clientId || null;
    const clientName = msg.client?.name || matchedNumber?.client?.name || null;
    const normalizedContact = normalizePhone(contact);
    const normalizedBusinessNumber = normalizePhone(businessNumber);
    const key = `${clientId || "no-client"}:${normalizedBusinessNumber || "no-sender"}:${normalizedContact}`;

    if (!conversationsMap.has(key)) {
      const availableNumbers = clientNumbers
        .filter((item) => {
          if (clientId) return item.clientId === clientId;
          if (normalizedBusinessNumber) {
            return matchesPhone(item.number, normalizedBusinessNumber);
          }
          return false;
        })
        .map((item) => ({
          id: item.id,
          number: normalizePhone(item.number),
          label: item.label,
          clientId: item.clientId,
          clientName: item.client?.name,
        }));

      if (
        normalizedBusinessNumber &&
        !availableNumbers.some((item) => matchesPhone(item.number, normalizedBusinessNumber))
      ) {
        availableNumbers.unshift({
          id: "conversation-number",
          number: normalizedBusinessNumber,
          label: "Número da conversa",
          clientId: clientId || "",
          clientName: clientName || "",
        });
      }

      conversationsMap.set(key, {
        id: key,
        contact: normalizedContact,
        businessNumber: normalizedBusinessNumber,
        availableNumbers,
        clientId,
        clientName,
        lastMessage: msg.text || msg.status || "Sem conteúdo",
        lastStatus: msg.status,
        lastDate: msg.createdAt,
        messages: [],
      });
    }

    const conv = conversationsMap.get(key);

    if (!conv.businessNumber && businessNumber) {
      conv.businessNumber = normalizePhone(businessNumber);
    }

    if (!conv.clientId && clientId) conv.clientId = clientId;
    if (!conv.clientName && clientName) conv.clientName = clientName;

    conv.messages.push(msg);
  }

  return NextResponse.json(Array.from(conversationsMap.values()));
}
