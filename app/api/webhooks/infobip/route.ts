import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function getStatus(item: any) {
  return (
    item?.status?.groupName ||
    item?.status?.name ||
    item?.status?.description ||
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
    item?.message?.button?.text ||
    item?.message?.list?.title ||
    item?.message?.interactive?.button_reply?.title ||
    item?.message?.interactive?.list_reply?.title ||
    item?.message?.caption ||
    item?.body ||
    null
  );
}

function getMessageId(item: any) {
  return (
    item?.messageId ||
    item?.message_id ||
    item?.messageID ||
    item?.message?.messageId ||
    item?.message?.messageID ||
    item?.id ||
    item?.message?.id ||
    null
  );
}

function getFrom(item: any) {
  return (
    item?.from ||
    item?.sender ||
    item?.contact?.phoneNumber ||
    item?.contact?.waId ||
    item?.contact?.id ||
    item?.channelInfo?.from ||
    item?.channelInfo?.sender ||
    item?.message?.from ||
    item?.message?.sender ||
    null
  );
}

function getTo(item: any) {
  return (
    item?.to ||
    item?.destination ||
    item?.recipient ||
    item?.receiver ||
    item?.channelInfo?.to ||
    item?.channelInfo?.destination ||
    item?.message?.to ||
    item?.message?.recipient ||
    null
  );
}

function isInboundMessage(item: any, status: any, text: any) {
  const direction = String(
    item?.direction || item?.message?.direction || ""
  ).toLowerCase();
  const event = String(
    item?.event || item?.type || item?.message?.type || ""
  ).toLowerCase();

  return (
    direction === "inbound" ||
    direction === "mo" ||
    event.includes("message_received") ||
    event.includes("messagereceived") ||
    event.includes("inbound") ||
    Boolean(item?.receivedAt && item?.message) ||
    Boolean(text && !status)
  );
}

async function getWebhookSetting(key: string) {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key } });
    return setting?.value || null;
  } catch {
    return null;
  }
}

async function setWebhookSetting(key: string, value: any) {
  try {
    await prisma.appSetting.upsert({
      where: { key },
      create: {
        key,
        value: typeof value === "string" ? value : JSON.stringify(value),
      },
      update: {
        value: typeof value === "string" ? value : JSON.stringify(value),
      },
    });
  } catch (error) {
    console.error("ERRO AO REGISTRAR STATUS DO WEBHOOK:", error);
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lastHit = await getWebhookSetting("infobip.webhook.lastHit");
  const lastSummary = await getWebhookSetting("infobip.webhook.lastSummary");

  return NextResponse.json({
    ok: true,
    message: "Webhook Infobip ativo. Configure esta URL publica na Infobip para receber mensagens.",
    endpoint: `${url.origin}${url.pathname}`,
    method: "POST",
    lastHit,
    lastSummary: lastSummary ? JSON.parse(lastSummary) : null,
  });
}

async function findClientIdByNumber(from?: string | null, to?: string | null) {
  const fromClean = normalizePhone(from);
  const toClean = normalizePhone(to);
  const numbers = [fromClean, toClean].filter(Boolean);

  if (!numbers.length) return null;

  const clientNumbers = await prisma.clientNumber.findMany();

  const found = clientNumbers.find((item) => {
    const saved = normalizePhone(item.number);

    return numbers.some((incoming) => {
      return (
        saved === incoming ||
        saved.endsWith(incoming) ||
        incoming.endsWith(saved)
      );
    });
  });

  if (found?.clientId) return found.clientId;

  const fallbackClient = await prisma.client.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return fallbackClient?.id || null;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    console.log("INFOBIP WEBHOOK RECEBIDO:", JSON.stringify(body, null, 2));

    const items = Array.isArray(body?.results)
      ? body.results
      : Array.isArray(body?.messages)
        ? body.messages
        : Array.isArray(body)
          ? body
          : [body];

    await setWebhookSetting("infobip.webhook.lastHit", new Date().toISOString());
    await setWebhookSetting("infobip.webhook.lastSummary", {
      items: items.length,
      firstMessageId: getMessageId(items[0]),
      firstFrom: getFrom(items[0]),
      firstTo: getTo(items[0]),
      firstStatus: getStatus(items[0]),
      hasText: Boolean(getText(items[0])),
    });

    for (const item of items) {
      const infobipMsgId = getMessageId(item);
      const status = getStatus(item);
      const from = getFrom(item);
      const to = getTo(item);
      const text = getText(item);
      const isInbound = isInboundMessage(item, status, text);
      const direction = isInbound ? "inbound" : "outbound";
      const clientId = await findClientIdByNumber(from, to);
      const now = new Date();

      const existing = infobipMsgId
        ? await prisma.message.findUnique({
            where: { infobipMsgId },
          })
        : null;

      const lowerStatus = String(status || "").toLowerCase();

      const updateData: any = {
        status,
        raw: body,
      };

      if (lowerStatus.includes("delivered")) {
        updateData.deliveredAt = now;
      }

      if (lowerStatus.includes("seen") || lowerStatus.includes("read")) {
        updateData.seenAt = now;
      }

      if (
        lowerStatus.includes("failed") ||
        lowerStatus.includes("rejected") ||
        lowerStatus.includes("undeliverable")
      ) {
        updateData.failedAt = now;
        updateData.failureReason =
          item?.status?.description ||
          item?.error?.message ||
          item?.description ||
          null;
      }

      let message;

      if (existing) {
        message = await prisma.message.update({
          where: { id: existing.id },
          data: {
            ...updateData,
            clientId: existing.clientId || clientId,
          },
        });
      } else {
        message = await prisma.message.create({
          data: {
            infobipMsgId,
            clientId,
            from,
            to,
            text,
            direction,
            status,
            raw: body,
            sentAt: direction === "outbound" ? now : null,
            receivedAt: direction === "inbound" ? now : null,
            ...updateData,
          },
        });
      }

      await prisma.messageEvent.create({
        data: {
          messageId: message.id,
          infobipMsgId,
          status,
          description:
            item?.status?.description ||
            item?.error?.message ||
            item?.description ||
            null,
          raw: item,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("ERRO WEBHOOK INFOBIP:", error);

    return NextResponse.json(
      { error: error.message || "Webhook error" },
      { status: 500 }
    );
  }
}
