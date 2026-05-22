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

function getInfobipMessageId(data: any) {
  return (
    data?.messages?.[0]?.messageId ||
    data?.messages?.[0]?.messageID ||
    data?.bulkId ||
    data?.messageId ||
    null
  );
}

async function hasOpenCustomerCareWindow(from: string, to: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT "id"
      FROM "Message"
      WHERE lower("direction"::text) = 'inbound'
        AND regexp_replace("from", '\\D', '', 'g') = $1
        AND regexp_replace("to", '\\D', '', 'g') = $2
        AND COALESCE("receivedAt", "createdAt") >= now() - interval '24 hours'
      LIMIT 1
    `,
    to,
    from
  );

  return rows.length > 0;
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

  if (!to || !text) {
    return NextResponse.json(
      { error: "Informe destinatário e mensagem." },
      { status: 400 }
    );
  }

  const baseUrl = process.env.INFOBIP_BASE_URL;
  const apiKey = process.env.INFOBIP_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      {
        error:
          "INFOBIP_BASE_URL ou INFOBIP_API_KEY não configurado no .env do servidor.",
      },
      { status: 500 }
    );
  }

  const allowedNumbers = await prisma.clientNumber.findMany({
    where:
      user.role === "admin"
        ? undefined
        : {
            clientId: user.clientId || "__NO_CLIENT__",
          },
    select: {
      id: true,
      number: true,
      clientId: true,
    },
  });

  const selectedNumber =
    allowedNumbers.find((item) => matchesPhone(item.number, requestedFrom)) ||
    allowedNumbers[0];

  if (!selectedNumber) {
    return NextResponse.json(
      {
        error:
          "Nenhum número Infobip vinculado a este usuário/cliente. Cadastre um número no painel de clientes.",
      },
      { status: 400 }
    );
  }

  const from = normalizePhone(selectedNumber.number);

  const canReply = await hasOpenCustomerCareWindow(from, to);

  if (!canReply) {
    return NextResponse.json(
      {
        error:
          "A janela gratuita de 24h ainda nao esta aberta. Aguarde o cliente responder antes de enviar mensagem livre.",
      },
      { status: 403 }
    );
  }

  const infobipRes = await fetch(
    `${baseUrl.replace(/\/$/, "")}/whatsapp/1/message/text`,
    {
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
    }
  );

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
        error: "Infobip recusou o envio.",
        details: infobipData,
      },
      { status: infobipRes.status }
    );
  }

  const infobipMsgId = getInfobipMessageId(infobipData);

  const message = await prisma.message.create({
    data: {
      infobipMsgId,
      clientId: selectedNumber.clientId,
      from,
      to,
      text,
      direction: "outbound",
      status: "SENT",
      sentAt: new Date(),
      raw: infobipData || {},
    },
  });

  return NextResponse.json({
    success: true,
    message,
    infobip: infobipData,
  });
}
