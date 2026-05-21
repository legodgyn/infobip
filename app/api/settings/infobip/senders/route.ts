import { getCurrentUser } from "@/lib/auth";
import { fetchInfobipSenders } from "@/lib/infobip-senders";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim().toLowerCase();

  try {
    const senders = await fetchInfobipSenders();
    const filtered = search
      ? senders.filter((sender) => {
          return (
            sender.sender.includes(search) ||
            String(sender.displayName || "").toLowerCase().includes(search)
          );
        })
      : senders;

    return NextResponse.json({
      ok: true,
      total: senders.length,
      senders: filtered,
    });
  } catch (error) {
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
