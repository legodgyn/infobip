import {
  getInfobipSenderSyncState,
  listInfobipSenders,
  startInfobipSenderSync,
} from "@/lib/infobip-config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const senders = await listInfobipSenders({
    search: searchParams.get("search") || "",
    limit: Number(searchParams.get("limit") || 300),
  });
  return NextResponse.json({ senders, sync: getInfobipSenderSyncState() });
}

export async function POST() {
  const result = startInfobipSenderSync();
  return NextResponse.json(
    {
      ok: true,
      message: result.message,
      sync: result.sync,
      senders: await listInfobipSenders({ limit: 300 }),
    },
    { status: result.started ? 202 : 200 }
  );
}
