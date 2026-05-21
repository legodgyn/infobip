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

const isInbound =
  item?.event === "MESSAGE_RECEIVED" ||
  item?.event === "messageReceived" ||
  item?.direction === "inbound" ||
  item?.direction === "INBOUND" ||
  Boolean(text && !status);

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
