import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type MessageRow = {
  id: string;
  infobipMsgId: string | null;
  clientId: string | null;
  clientName: string | null;
  from: string;
  to: string;
  text: string | null;
  direction: string;
  status: string | null;
  createdAt: Date;
  sentAt: Date | null;
  receivedAt: Date | null;
  deliveredAt: Date | null;
  seenAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  raw: unknown;
};

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

export async function GET(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const selectedNumber = normalizePhone(searchParams.get("number"));
  const selectedClientId =
    user.role === "admin" ? searchParams.get("clientId") || "" : user.clientId || "";

  const filters: string[] = [`linked."clientId" IS NOT NULL`];
  const values: unknown[] = [];

  if (selectedClientId) {
    values.push(selectedClientId);
    filters.push(`linked."clientId" = $${values.length}`);
  } else if (user.role !== "admin") {
    filters.push(`FALSE`);
  }

  if (selectedNumber) {
    values.push(selectedNumber);
    const index = values.length;
    filters.push(
      `(regexp_replace(linked."number", '\\D', '', 'g') = $${index} OR regexp_replace(linked."number", '\\D', '', 'g') LIKE '%' || $${index} OR $${index} LIKE '%' || regexp_replace(linked."number", '\\D', '', 'g'))`
    );
  }

  const messages = await prisma.$queryRawUnsafe<MessageRow[]>(
    `
      SELECT
        m."id",
        m."infobipMsgId",
        COALESCE(m."clientId", linked."clientId") AS "clientId",
        COALESCE(mc."name", linked."clientName") AS "clientName",
        m."from",
        m."to",
        m."text",
        m."direction"::text AS "direction",
        m."status",
        m."createdAt",
        m."sentAt",
        m."receivedAt",
        m."deliveredAt",
        m."seenAt",
        m."failedAt",
        m."failureReason",
        m."raw"
      FROM "Message" m
      LEFT JOIN "Client" mc ON mc."id" = m."clientId"
      LEFT JOIN LATERAL (
        SELECT
          cn."number",
          cn."clientId",
          c."name" AS "clientName"
        FROM "ClientNumber" cn
        JOIN "Client" c ON c."id" = cn."clientId"
        WHERE
          regexp_replace(cn."number", '\\D', '', 'g') = regexp_replace(
            CASE
              WHEN m."direction"::text = 'inbound' THEN m."to"
              ELSE m."from"
            END,
            '\\D',
            '',
            'g'
          )
          OR regexp_replace(cn."number", '\\D', '', 'g') LIKE '%' || regexp_replace(
            CASE
              WHEN m."direction"::text = 'inbound' THEN m."to"
              ELSE m."from"
            END,
            '\\D',
            '',
            'g'
          )
          OR regexp_replace(
            CASE
              WHEN m."direction"::text = 'inbound' THEN m."to"
              ELSE m."from"
            END,
            '\\D',
            '',
            'g'
          ) LIKE '%' || regexp_replace(cn."number", '\\D', '', 'g')
        ORDER BY cn."createdAt" DESC
        LIMIT 1
      ) linked ON true
      WHERE ${filters.join(" AND ")}
      ORDER BY m."createdAt" DESC
      LIMIT 500
    `,
    ...values
  );

  const conversationsMap = new Map<string, any>();

  for (const msg of messages) {
    const contact = msg.direction === "inbound" ? msg.from : msg.to;
    const businessNumber = msg.direction === "inbound" ? msg.to : msg.from;

    if (!contact) continue;

    const clientId = msg.clientId || null;
    const clientName = msg.clientName || null;

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
