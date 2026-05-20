import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyRealtime } from "@/lib/realtime";

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
  const direction = String(item?.direction || item?.message?.direction || "").toLowerCase();
  const event = String(item?.event || item?.type || item?.message?.type || "").toLowerCase();

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

export async function GET(req: Request) {
  const url = new URL(req.url);

  return NextResponse.json({
    ok: true,
    message: "Webhook Infobip ativo. Configure esta URL pública na Infobip para receber mensagens.",
    endpoint: `${url.origin}${url.pathname}`,
    method: "POST",
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

  return found?.clientId || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("INFOBIP WEBHOOK RECEBIDO:", JSON.stringify(body, null, 2));

    const items = Array.isArray(body?.results)
      ? body.results
      : Array.isArray(body?.messages)
      ? body.messages
      : Array.isArray(body)
      ? body
      : [body];

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
    notifyRealtime();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("ERRO WEBHOOK INFOBIP:", error);

    return NextResponse.json(
      { error: error.message || "Webhook error" },
      { status: 500 }
    );
  }
}
