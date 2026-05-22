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

  const where =
    user.role === "admin"
      ? {}
      : {
          clientId: user.clientId || "__NO_CLIENT__",
        };

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const clientNumbers = await prisma.$queryRaw<
    Array<{
      number: string;
      clientId: string;
      clientName: string | null;
    }>
  >`
    SELECT
      cn."number",
      cn."clientId",
      c."name" AS "clientName"
    FROM "ClientNumber" cn
    LEFT JOIN "Client" c ON c."id" = cn."clientId"
  `;

  const conversationsMap = new Map<string, any>();

  for (const msg of messages) {
    const contact = msg.direction === "inbound" ? msg.from : msg.to;
    const businessNumber = msg.direction === "inbound" ? msg.to : msg.from;

    if (!contact) continue;

    const matchedNumber = clientNumbers.find((item) =>
      matchesPhone(item.number, businessNumber)
    );

    const clientId = msg.clientId || matchedNumber?.clientId || null;
    const clientName = matchedNumber?.clientName || null;

    const key = normalizePhone(contact);

    if (!conversationsMap.has(key)) {
      conversationsMap.set(key, {
        contact: normalizePhone(contact),
        businessNumber: normalizePhone(businessNumber),
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
