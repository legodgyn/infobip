import { getCurrentUser } from "@/lib/auth";
import { fetchInfobipSenders, normalizeSenderNumber } from "@/lib/infobip-senders";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SenderRow = {
  sender?: string | null;
  number?: string | null;
  displayName?: string | null;
  label?: string | null;
  status?: string | null;
};

function filterSenders(senders: SenderRow[], search: string) {
  const normalized = senders
    .map((sender) => {
      const number = normalizeSenderNumber(sender.sender || sender.number);
      if (!number) return null;

      return {
        sender: number,
        displayName: sender.displayName || sender.label || null,
        status: sender.status || null,
      };
    })
    .filter((sender): sender is { sender: string; displayName: string | null; status: string | null } =>
      Boolean(sender)
    );

  if (!search) return normalized;

  return normalized.filter((sender) => {
    return (
      sender.sender.includes(search) ||
      String(sender.displayName || "").toLowerCase().includes(search)
    );
  });
}

async function fetchFallbackSenders() {
  try {
    const infobipRows = await prisma.$queryRawUnsafe<SenderRow[]>(
      'SELECT "sender", "displayName", "status" FROM "InfobipSender" ORDER BY "displayName" NULLS LAST, "sender"'
    );

    if (infobipRows.length > 0) {
      return {
        source: "InfobipSender",
        rows: infobipRows,
      };
    }
  } catch {
    // The restored project does not require the old InfobipSender table.
  }

  const linkedRows = await prisma.clientNumber.findMany({
    select: {
      number: true,
      label: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    source: "ClientNumber",
    rows: linkedRows,
  };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim().toLowerCase();

  try {
    const senders = await fetchInfobipSenders();
    const filtered = filterSenders(senders, search);

    return NextResponse.json({
      ok: true,
      total: senders.length,
      senders: filtered,
      source: "Infobip API",
    });
  } catch (error) {
    const fallback = await fetchFallbackSenders();
    const senders = filterSenders(fallback.rows, search);

    if (senders.length > 0) {
      return NextResponse.json({
        ok: true,
        total: fallback.rows.length,
        senders,
        source: fallback.source,
        warning:
          error instanceof Error
            ? `A API da Infobip falhou, carreguei do banco: ${error.message}`
            : "A API da Infobip falhou, carreguei do banco.",
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel buscar os numeros na Infobip.",
      },
      { status: 400 }
    );
  }
}
