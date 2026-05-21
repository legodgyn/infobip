import { importInfobipSendersToClient } from "@/lib/infobip-config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await importInfobipSendersToClient(
      body?.clientId || null,
      Array.isArray(body?.numbers) ? body.numbers : undefined
    );
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        imported: 0,
        skipped: 0,
        message: error?.message || "Não foi possível importar os números.",
      },
      { status: 500 }
    );
  }
}
