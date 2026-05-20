import { listInfobipSenders } from "@/lib/infobip-config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const senders = await listInfobipSenders();
  return NextResponse.json({ senders });
}
