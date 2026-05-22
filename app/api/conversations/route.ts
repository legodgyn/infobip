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
};

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

export async function GET(req: Request) {
  try {
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
        `(linked."cleanNumber" = $${index} OR linked."cleanNumber" LIKE '%' || $${index} OR $${index} LIKE '%' || linked."cleanNumber")`
      );
    }

    const messages = await prisma.$queryRawUnsafe<MessageRow[]>(
      `
        WITH scoped_messages AS (
          SELECT
            m."id",
            m."infobipMsgId",
            m."clientId" AS "messageClientId",
            m."from",
            m."to",
            m."text",
            m."direction"::text AS "direction",
            m."status",
            m."createdAt",
            regexp_replace(
              CASE
                WHEN m."direction"::text = 'inbound' THEN m."to"
                ELSE m."from"
              END,
              '\\D',
              '',
              'g'
            ) AS "businessNumber"
          FROM "Message" m
        )
        SELECT
          sm."id",
          sm."infobipMsgId",
          COALESCE(sm."messageClientId", linked."clientId") AS "clientId",
          COALESCE(mc."name", linked."clientName") AS "clientName",
          sm."from",
          sm."to",
          sm."text",
          sm."direction",
          sm."status",
          sm."createdAt"
        FROM scoped_messages sm
        LEFT JOIN "Client" mc ON mc."id" = sm."messageClientId"
        LEFT JOIN LATERAL (
          SELECT
            cn."number",
            regexp_replace(cn."number", '\\D', '', 'g') AS "cleanNumber",
            cn."clientId",
            c."name" AS "clientName"
          FROM "ClientNumber" cn
          JOIN "Client" c ON c."id" = cn."clientId"
          WHERE
            regexp_replace(cn."number", '\\D', '', 'g') = sm."businessNumber"
            OR regexp_replace(cn."number", '\\D', '', 'g') LIKE '%' || sm."businessNumber"
            OR sm."businessNumber" LIKE '%' || regexp_replace(cn."number", '\\D', '', 'g')
          LIMIT 1
        ) linked ON true
        WHERE ${filters.join(" AND ")}
        ORDER BY sm."createdAt" DESC
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
          lastMessage: msg.text || msg.status || "Sem conteudo",
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
  } catch (error: any) {
    console.error("ERRO AO CARREGAR CONVERSAS:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel carregar as conversas" },
      { status: 500 }
    );
  }
}
