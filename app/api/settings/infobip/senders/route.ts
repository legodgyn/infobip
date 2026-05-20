import {
  listInfobipSenders,
  refreshInfobipSenders,
} from "@/lib/infobip-config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const senders = await listInfobipSenders();
  return NextResponse.json({ senders });
}

export async function POST() {
  const result = await refreshInfobipSenders();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
