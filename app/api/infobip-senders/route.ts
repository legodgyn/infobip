import { listInfobipSenders } from "@/lib/infobip-config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const senders = await listInfobipSenders({
    search: searchParams.get("search") || "",
    limit: Number(searchParams.get("limit") || 1000),
  });
  return NextResponse.json({ senders });
}
