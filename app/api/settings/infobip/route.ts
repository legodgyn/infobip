import {
  getInfobipConfig,
  maskApiKey,
  saveInfobipConfig,
  testInfobipConfig,
} from "@/lib/infobip-config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = await getInfobipConfig();

    return NextResponse.json({
      baseUrl: config.baseUrl,
      apiKeyConfigured: Boolean(config.apiKey),
      apiKeyPreview: maskApiKey(config.apiKey),
      source: config.source,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar configuração." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();

    const config = await saveInfobipConfig({
      baseUrl: String(body?.baseUrl || ""),
      apiKey:
        typeof body?.apiKey === "string" && body.apiKey.trim()
          ? body.apiKey
          : undefined,
    });

    return NextResponse.json({
      success: true,
      baseUrl: config.baseUrl,
      apiKeyConfigured: Boolean(config.apiKey),
      apiKeyPreview: maskApiKey(config.apiKey),
      source: config.source,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao salvar configuração." },
      { status: 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const saved = await getInfobipConfig();
    const result = await testInfobipConfig({
      baseUrl: String(body?.baseUrl || saved.baseUrl || ""),
      apiKey:
        typeof body?.apiKey === "string" && body.apiKey.trim()
          ? body.apiKey
          : saved.apiKey,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao testar configuração." },
      { status: 500 }
    );
  }
}
