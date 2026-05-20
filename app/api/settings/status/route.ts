import { getInfobipConfig } from "@/lib/infobip-config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const infobip = await getInfobipConfig();

  return NextResponse.json({
    database: Boolean(process.env.DATABASE_URL),
    infobipBaseUrl: Boolean(infobip.baseUrl),
    infobipApiKey: Boolean(infobip.apiKey),
    infobipSource: infobip.source,
  });
}
