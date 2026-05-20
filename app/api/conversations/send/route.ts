import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyRealtime } from "@/lib/realtime";
import { getInfobipConfig } from "@/lib/infobip-config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function matchesPhone(a?: string | null, b?: string | null) {
  const left = normalizePhone(a);
  const right = normalizePhone(b);

  if (!left || !right) return false;

  return left === right || left.endsWith(right) || right.endsWith(left);
}

function getInfobipMessageId(data: any) {
  return (
    data?.messages?.[0]?.messageId ||
    data?.messages?.[0]?.messageID ||
    data?.messages?.[0]?.id ||
    data?.bulkId ||
    data?.messageId ||
    data?.id ||
    null
  );
}

function getInfobipStatus(data: any) {
  const status =
    data?.messages?.[0]?.status?.groupName ||
    data?.messages?.[0]?.status?.name ||
    data?.status?.groupName ||
    data?.status?.name ||
    data?.messages?.[0]?.status ||
    data?.status ||
    "SENT";

  return typeof status === "string" ? status : JSON.stringify(status);
}

function getInfobipErrorMessage(data: any) {
  return (
    data?.requestError?.serviceException?.text ||
    data?.requestError?.serviceException?.message ||
    data?.error?.message ||
    data?.message ||
    data?.raw ||
    "Infobip recusou o envio."
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const to = normalizePhone(body?.to);
  const text = String(body?.text || "").trim();
  const requestedFrom = normalizePhone(body?.from);
  const requestedClientId = String(body?.clientId || "").trim();

  if (!to || !text) {
    return NextResponse.json(
      { error: "Informe destinatário e mensagem." },
      { status: 400 }
    );
  }

  const { baseUrl, apiKey } = await getInfobipConfig();

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      {
        error:
          "Configure a URL base e a API key da Infobip na tela de Configurações.",
      },
      { status: 500 }
    );
  }

  const allowedNumbers = await prisma.clientNumber.findMany({
    where:
      user.role === "admin"
        ? requestedClientId
          ? { clientId: requestedClientId }
          : undefined
        : {
            clientId: user.clientId || "__NO_CLIENT__",
          },
    include: {
      client: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const selectedNumber = requestedFrom
    ? allowedNumbers.find((item) => matchesPhone(item.number, requestedFrom))
    : allowedNumbers[0];

  if (!selectedNumber) {
    return NextResponse.json(
      {
        error:
          requestedFrom
            ? "O remetente selecionado não está vinculado a este cliente."
            : "Nenhum número Infobip vinculado a este usuário/cliente. Cadastre um número no painel de clientes.",
      },
      { status: 400 }
    );
  }

  const from = normalizePhone(selectedNumber.number);
  const endpoint = `${baseUrl.replace(/\/$/, "")}/whatsapp/1/message/text`;

  const infobipRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `App ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      content: {
        text,
      },
    }),
  });

  const responseText = await infobipRes.text();

  let infobipData: any = null;

  try {
    infobipData = responseText ? JSON.parse(responseText) : null;
  } catch {
    infobipData = { raw: responseText };
  }

  if (!infobipRes.ok) {
    return NextResponse.json(
      {
        error: getInfobipErrorMessage(infobipData),
        details: infobipData,
      },
      { status: infobipRes.status }
    );
  }

  const infobipMsgId = getInfobipMessageId(infobipData);
  const status = getInfobipStatus(infobipData);

  const message = await prisma.message.create({
    data: {
      infobipMsgId,
      clientId: selectedNumber.clientId,
      from,
      to,
      text,
      direction: "outbound",
      status,
      sentAt: new Date(),
      raw: infobipData || {},
    },
  });

  await prisma.messageEvent.create({
    data: {
      messageId: message.id,
      infobipMsgId,
      status,
      description: "Mensagem enviada pelo painel",
      raw: infobipData || {},
    },
  });

  notifyRealtime();

  return NextResponse.json({
    success: true,
    message,
    infobip: infobipData,
  });
}
