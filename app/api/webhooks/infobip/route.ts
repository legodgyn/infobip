import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyRealtime } from "@/lib/realtime";

export const runtime = "nodejs";

type ExistingMessage = {
  id: string;
  clientId: string | null;
};

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getStatus(item: any) {
  return (
    item?.status?.groupName ||
    item?.status?.name ||
    item?.status ||
    item?.event ||
    item?.message?.status ||
    null
  );
}

function getText(item: any) {
  return (
    item?.message?.text ||
    item?.text ||
    item?.content?.text ||
    item?.message?.content?.text ||
    item?.message?.content?.body ||
    item?.body ||
    null
  );
}

function getMessageId(item: any) {
  return (
    item?.messageId ||
    item?.message_id ||
    item?.messageID ||
    item?.id ||
    item?.message?.id ||
    null
  );
}

function getFrom(item: any) {
  return (
    item?.from ||
    item?.sender ||
    item?.channelInfo?.from ||
    item?.message?.from ||
    null
  );
}

function getTo(item: any) {
  return (
    item?.to ||
    item?.destination ||
    item?.channelInfo?.to ||
    item?.message?.to ||
    null
  );
}

function getItems(body: any) {
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.messages)) return body.messages;
  if (Array.isArray(body)) return body;
  return [body];
}

async function findClientIdByNumber(from?: string | null, to?: string | null) {
  const fromClean = normalizePhone(from);
  const toClean = normalizePhone(to);
  const numbers = [fromClean, toClean].filter(Boolean);

  if (!numbers.length) return null;

  const filters = numbers
    .map((_, index) => {
      const param = index + 1;
      return `(regexp_replace("number", '\\D', '', 'g') = $${param} OR regexp_replace("number", '\\D', '', 'g') LIKE '%' || $${param} OR $${param} LIKE '%' || regexp_replace("number", '\\D', '', 'g'))`;
    })
    .join(" OR ");

  const rows = await prisma.$queryRawUnsafe<Array<{ clientId: string }>>(
    `
      SELECT "clientId"
      FROM "ClientNumber"
      WHERE ${filters}
      LIMIT 1
    `,
    ...numbers
  );

  return rows[0]?.clientId || null;
}

async function findExistingMessage(infobipMsgId: string | null) {
  if (!infobipMsgId) return null;

  const rows = await prisma.$queryRawUnsafe<ExistingMessage[]>(
    `
      SELECT "id", "clientId"
      FROM "Message"
      WHERE "infobipMsgId" = $1
      LIMIT 1
    `,
    infobipMsgId
  );

  return rows[0] || null;
}

async function saveMessage(item: any, body: any) {
  const infobipMsgId = asString(getMessageId(item)) || null;
  const status = asString(getStatus(item)) || null;
  const from = normalizePhone(getFrom(item));
  const to = normalizePhone(getTo(item));
  const text = asString(getText(item)) || null;
  const lowerStatus = String(status || "").toLowerCase();
  const rawBody = JSON.stringify(body);
  const rawItem = JSON.stringify(item);

  const isInbound =
    item?.event === "MESSAGE_RECEIVED" ||
    item?.event === "messageReceived" ||
    item?.direction === "inbound" ||
    item?.direction === "INBOUND" ||
    Boolean(text && !status);

  const direction = isInbound ? "inbound" : "outbound";
  const clientId = await findClientIdByNumber(from, to);
  const description =
    item?.status?.description ||
    item?.error?.message ||
    item?.description ||
    null;

  const deliveredAt = lowerStatus.includes("delivered") ? new Date() : null;
  const seenAt =
    lowerStatus.includes("seen") || lowerStatus.includes("read") ? new Date() : null;
  const failedAt =
    lowerStatus.includes("failed") ||
    lowerStatus.includes("rejected") ||
    lowerStatus.includes("undeliverable")
      ? new Date()
      : null;

  const existing = await findExistingMessage(infobipMsgId);
  let messageId = existing?.id || null;

  if (existing) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "Message"
        SET
          "clientId" = COALESCE("clientId", $2),
          "status" = $3,
          "raw" = $4::jsonb,
          "deliveredAt" = COALESCE("deliveredAt", $5),
          "seenAt" = COALESCE("seenAt", $6),
          "failedAt" = COALESCE("failedAt", $7),
          "failureReason" = COALESCE($8, "failureReason")
        WHERE "id" = $1
      `,
      existing.id,
      clientId,
      status,
      rawBody,
      deliveredAt,
      seenAt,
      failedAt,
      description
    );
  } else {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        INSERT INTO "Message" (
          "id",
          "infobipMsgId",
          "clientId",
          "from",
          "to",
          "text",
          "direction",
          "status",
          "sentAt",
          "receivedAt",
          "deliveredAt",
          "seenAt",
          "failedAt",
          "failureReason",
          "raw",
          "createdAt"
        )
        VALUES (
          'msg_' || replace(gen_random_uuid()::text, '-', ''),
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14::jsonb,
          now()
        )
        RETURNING "id"
      `,
      infobipMsgId,
      clientId,
      from,
      to,
      text,
      direction,
      status,
      direction === "outbound" ? new Date() : null,
      direction === "inbound" ? new Date() : null,
      deliveredAt,
      seenAt,
      failedAt,
      description,
      rawBody
    );

    messageId = rows[0]?.id || null;
  }

  if (!messageId) return;

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "MessageEvent" (
        "id",
        "messageId",
        "infobipMsgId",
        "status",
        "description",
        "raw",
        "createdAt"
      )
      VALUES (
        'evt_' || replace(gen_random_uuid()::text, '-', ''),
        $1,
        $2,
        $3,
        $4,
        $5::jsonb,
        now()
      )
    `,
    messageId,
    infobipMsgId,
    status,
    description,
    rawItem
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      messagesTotal: bigint | number | string;
      eventsTotal: bigint | number | string;
      lastMessageAt: Date | null;
    }>
  >(`
    SELECT
      (SELECT COUNT(*) FROM "Message") AS "messagesTotal",
      (SELECT COUNT(*) FROM "MessageEvent") AS "eventsTotal",
      (SELECT MAX("createdAt") FROM "Message") AS "lastMessageAt"
  `);

  return NextResponse.json({
    ok: true,
    message: "Webhook Infobip ativo. Configure esta URL publica na Infobip para receber mensagens.",
    endpoint: `${url.origin}/api/webhooks/infobip`,
    method: "POST",
    messagesTotal: Number(rows[0]?.messagesTotal || 0),
    eventsTotal: Number(rows[0]?.eventsTotal || 0),
    lastMessageAt: rows[0]?.lastMessageAt || null,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = getItems(body);

    console.log("INFOBIP WEBHOOK RECEBIDO:", JSON.stringify(body, null, 2));

    for (const item of items) {
      await saveMessage(item, body);
    }

    notifyRealtime();
    return NextResponse.json({ success: true, received: items.length });
  } catch (error: any) {
    console.error("ERRO WEBHOOK INFOBIP:", error);

    return NextResponse.json(
      { error: error.message || "Webhook error" },
      { status: 500 }
    );
  }
}
