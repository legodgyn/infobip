import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { prisma } from "@/lib/prisma";

const INFOBIP_BASE_URL_KEY = "infobip.baseUrl";
const INFOBIP_API_KEY_KEY = "infobip.apiKey";
const ENCRYPTION_PREFIX = "enc:v1:";

export type InfobipConfig = {
  baseUrl: string;
  apiKey: string;
  source: "database" | "env" | "mixed" | "none";
};

type InfobipSenderSyncState = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  ok: boolean | null;
  status: number | null;
  message: string;
  total: number;
};

const globalForInfobip = globalThis as typeof globalThis & {
  infobipSenderSyncState?: InfobipSenderSyncState;
};

const infobipSenderSyncState =
  globalForInfobip.infobipSenderSyncState ||
  (globalForInfobip.infobipSenderSyncState = {
    running: false,
    startedAt: null,
    finishedAt: null,
    ok: null,
    status: null,
    message: "",
    total: 0,
  });

function encryptionKey() {
  const secret =
    process.env.JWT_SECRET ||
    process.env.DATABASE_URL ||
    "infobip-monitor-local-secret";

  return createHash("sha256").update(secret).digest();
}

function encryptValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString("base64")}:${tag.toString(
    "base64"
  )}:${encrypted.toString("base64")}`;
}

function decryptValue(value?: string | null) {
  if (!value) return "";
  if (!value.startsWith(ENCRYPTION_PREFIX)) return value;

  try {
    const payload = value.slice(ENCRYPTION_PREFIX.length);
    const [iv, tag, encrypted] = payload.split(":");

    if (!iv || !tag || !encrypted) return "";

    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(iv, "base64")
    );

    decipher.setAuthTag(Buffer.from(tag, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

function cleanBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

async function getSetting(key: string) {
  try {
    const appSetting = (prisma as any).appSetting;
    if (!appSetting) return null;

    return await appSetting.findUnique({ where: { key } });
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: string) {
  const appSetting = (prisma as any).appSetting;

  if (!appSetting) {
    throw new Error(
      "A tabela AppSetting ainda não está disponível. Rode npm run prisma:generate e npm run prisma:migrate, depois reinicie o servidor."
    );
  }

  return appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

function normalizeSenderNumber(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function compactSenderRaw(item: any) {
  return {
    sender: item?.sender || item?.number || item?.phoneNumber || item?.from || null,
    displayName:
      item?.displayName ||
      item?.name ||
      item?.businessName ||
      item?.profile?.name ||
      null,
    status: item?.status || item?.state || null,
    testSender: Boolean(item?.testSender),
    keywords: Array.isArray(item?.keywords) ? item.keywords : [],
    numberKey: item?.numberKey || null,
    qualityRating: item?.qualityRating || null,
    limit: item?.limit || null,
    connectionStatus: item?.connectionStatus || null,
  };
}

function summarizeInfobipDetails(details: any, senders?: any[]) {
  if (Array.isArray(senders)) {
    return {
      total: senders.length,
      senders: senders.map((sender) => ({
        sender: sender.sender,
        displayName: sender.displayName,
        status: sender.status,
      })),
    };
  }

  if (Array.isArray(details)) {
    return { total: details.length };
  }

  if (details && typeof details === "object") {
    const source =
      details.senders || details.items || details.results || details.data || [];

    return {
      total: Array.isArray(source) ? source.length : undefined,
      requestError: details.requestError,
      errorCode: details.errorCode,
      message: details.message,
      description: details.description,
    };
  }

  if (typeof details === "string") {
    return details.slice(0, 500);
  }

  return details;
}

async function ensureInfobipSenderTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "InfobipSender" (
        "sender" TEXT NOT NULL,
        "displayName" TEXT,
        "status" TEXT,
        "raw" JSONB,
        "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InfobipSender_pkey" PRIMARY KEY ("sender")
      )
    `);
  } catch {
    // The route can still return an empty list if the database is unavailable.
  }
}

function extractSenders(details: any) {
  const source = Array.isArray(details)
    ? details
    : Array.isArray(details?.senders)
    ? details.senders
    : Array.isArray(details?.items)
    ? details.items
    : Array.isArray(details?.results)
    ? details.results
    : [];

  return source
    .map((item: any) => {
      const sender = normalizeSenderNumber(
        item?.sender || item?.number || item?.phoneNumber || item?.from
      );

      if (!sender) return null;

      return {
        sender,
        displayName:
          item?.displayName ||
          item?.name ||
          item?.businessName ||
          item?.profile?.name ||
          null,
        status:
          item?.status ||
          item?.state ||
          (item?.testSender ? "testSender" : null),
        raw: compactSenderRaw(item),
      };
    })
    .filter(Boolean);
}

export async function listInfobipSenders(options?: {
  search?: string;
  limit?: number;
}) {
  const infobipSender = (prisma as any).infobipSender;
  if (!infobipSender) return [];

  await ensureInfobipSenderTable();

  const search = options?.search?.trim();
  const limit = Math.min(Math.max(options?.limit || 300, 1), 1000);

  try {
    return await infobipSender.findMany({
      select: {
        sender: true,
        displayName: true,
        status: true,
        syncedAt: true,
      },
      where: search
        ? {
            OR: [
              { sender: { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
              { status: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: [{ displayName: "asc" }, { sender: "asc" }],
      take: limit,
    });
  } catch {
    return [];
  }
}

async function saveInfobipSendersFromDetails(details: any) {
  const infobipSender = (prisma as any).infobipSender;
  const senders = extractSenders(details);

  if (!infobipSender) return senders;

  await ensureInfobipSenderTable();

  try {
    const chunkSize = 100;

    for (let i = 0; i < senders.length; i += chunkSize) {
      const chunk = senders.slice(i, i + chunkSize);
      const values: string[] = [];
      const params: any[] = [];

      chunk.forEach((item: any, index: number) => {
        const offset = index * 4;
        values.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${
            offset + 4
          }::jsonb, NOW())`
        );
        params.push(
          item.sender,
          item.displayName,
          item.status,
          JSON.stringify(item.raw || {})
        );
      });

      await prisma.$executeRawUnsafe(
        `
          INSERT INTO "InfobipSender" ("sender", "displayName", "status", "raw", "syncedAt")
          VALUES ${values.join(",")}
          ON CONFLICT ("sender") DO UPDATE SET
            "displayName" = EXCLUDED."displayName",
            "status" = EXCLUDED."status",
            "raw" = EXCLUDED."raw",
            "syncedAt" = NOW()
        `,
        ...params
      );
    }
  } catch {
    return senders;
  }


  return senders;
}

export async function refreshInfobipSenders() {
  const config = await getInfobipConfig();

  if (!config.baseUrl || !config.apiKey) {
    return {
      ok: false,
      status: 0,
      message: "Configure a Infobip antes de atualizar os números.",
      senders: [],
    };
  }

  let res: Response;

  try {
    res = await fetch(`${config.baseUrl}/whatsapp/1/senders`, {
      method: "GET",
      headers: {
        Authorization: `App ${config.apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      message: error?.message || "NÃ£o foi possÃ­vel carregar os nÃºmeros da Infobip.",
      senders: await listInfobipSenders({ limit: 300 }),
    };
  }

  const responseText = await res.text();
  let details: any = null;

  try {
    details = responseText ? JSON.parse(responseText) : null;
  } catch {
    details = responseText;
  }

  const synced = res.ok ? await saveInfobipSendersFromDetails(details) : [];

  return {
    ok: res.ok,
    status: res.status,
    message: res.ok
      ? `${synced.length} número(s) sincronizado(s).`
      : "Não foi possível carregar os números da Infobip.",
    senders: await listInfobipSenders({ limit: 300 }),
    details: summarizeInfobipDetails(details, synced),
  };
}

export function getInfobipSenderSyncState() {
  return { ...infobipSenderSyncState };
}

export function startInfobipSenderSync() {
  if (infobipSenderSyncState.running) {
    return {
      started: false,
      sync: getInfobipSenderSyncState(),
      message: "A sincronizaÃ§Ã£o de nÃºmeros jÃ¡ estÃ¡ em andamento.",
    };
  }

  infobipSenderSyncState.running = true;
  infobipSenderSyncState.startedAt = new Date().toISOString();
  infobipSenderSyncState.finishedAt = null;
  infobipSenderSyncState.ok = null;
  infobipSenderSyncState.status = null;
  infobipSenderSyncState.message = "SincronizaÃ§Ã£o de nÃºmeros iniciada.";
  infobipSenderSyncState.total = 0;

  void refreshInfobipSenders()
    .then((result) => {
      infobipSenderSyncState.ok = result.ok;
      infobipSenderSyncState.status = result.status;
      infobipSenderSyncState.message = result.message;
      infobipSenderSyncState.total =
        typeof result.details?.total === "number"
          ? result.details.total
          : result.senders?.length || 0;
    })
    .catch((error: any) => {
      infobipSenderSyncState.ok = false;
      infobipSenderSyncState.status = 0;
      infobipSenderSyncState.message =
        error?.message || "NÃ£o foi possÃ­vel carregar os nÃºmeros da Infobip.";
    })
    .finally(() => {
      infobipSenderSyncState.running = false;
      infobipSenderSyncState.finishedAt = new Date().toISOString();
    });

  return {
    started: true,
    sync: getInfobipSenderSyncState(),
    message: "SincronizaÃ§Ã£o de nÃºmeros iniciada. A lista serÃ¡ atualizada em instantes.",
  };
}

export async function importInfobipSendersToClient(
  clientId?: string | null,
  selectedNumbers?: string[]
) {
  const targetClient =
    clientId ||
    (
      (await prisma.client.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })) ||
      (await prisma.client.create({
        data: {
          name: "Infobip",
          email: null,
          phone: null,
        },
        select: { id: true },
      }))
    )?.id;

  const selectedSet = new Set(
    (selectedNumbers || []).map((number) => normalizeSenderNumber(number))
  );
  if (selectedSet.size) await ensureInfobipSenderTable();
  const synced = selectedSet.size
    ? {
        senders: await (prisma as any).infobipSender.findMany({
          where: { sender: { in: Array.from(selectedSet) } },
          select: { sender: true, displayName: true, status: true },
        }),
      }
    : await refreshInfobipSenders();
  const senders = (synced.senders || []).filter((sender: any) => {
    if (!selectedSet.size) return true;
    return selectedSet.has(normalizeSenderNumber(sender.sender));
  });

  let imported = 0;
  let skipped = 0;
  let linkedMessages = 0;

  for (const sender of senders) {
    const number = normalizeSenderNumber(sender.sender);

    if (!number) {
      skipped++;
      continue;
    }

    try {
      await prisma.clientNumber.upsert({
        where: { number },
        update: {
          clientId: targetClient,
          label: sender.displayName || sender.status || "Infobip",
        },
        create: {
          clientId: targetClient,
          number,
          label: sender.displayName || sender.status || "Infobip",
        },
      });

      const linked = await prisma.message.updateMany({
        where: {
          OR: [{ from: { contains: number } }, { to: { contains: number } }],
        },
        data: {
          clientId: targetClient,
        },
      });

      linkedMessages += linked.count;
      imported++;
    } catch {
      skipped++;
    }
  }

  return {
    imported,
    skipped,
    linkedMessages,
    senders,
    message: `${imported} número(s) importado(s) para o cliente.`,
  };
}

export async function getInfobipConfig(): Promise<InfobipConfig> {
  const [baseUrlSetting, apiKeySetting] = await Promise.all([
    getSetting(INFOBIP_BASE_URL_KEY),
    getSetting(INFOBIP_API_KEY_KEY),
  ]);

  const baseUrl = cleanBaseUrl(
    baseUrlSetting?.value || process.env.INFOBIP_BASE_URL || ""
  );
  const apiKey = decryptValue(
    apiKeySetting?.value || process.env.INFOBIP_API_KEY || ""
  );

  const hasDbBaseUrl = Boolean(baseUrlSetting?.value);
  const hasDbApiKey = Boolean(apiKeySetting?.value);

  let source: InfobipConfig["source"] = "none";

  if (hasDbBaseUrl && hasDbApiKey) {
    source = "database";
  } else if (hasDbBaseUrl || hasDbApiKey) {
    source = "mixed";
  } else if (baseUrl || apiKey) {
    source = "env";
  }

  return { baseUrl, apiKey, source };
}

export async function saveInfobipConfig(input: {
  baseUrl: string;
  apiKey?: string;
}) {
  const baseUrl = cleanBaseUrl(input.baseUrl || "");

  if (!baseUrl) {
    throw new Error("Informe a URL base da Infobip.");
  }

  await setSetting(INFOBIP_BASE_URL_KEY, baseUrl);

  if (input.apiKey?.trim()) {
    await setSetting(INFOBIP_API_KEY_KEY, encryptValue(input.apiKey.trim()));
  }

  return getInfobipConfig();
}

export function maskApiKey(apiKey: string) {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "********";

  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

export async function testInfobipConfig(config: {
  baseUrl: string;
  apiKey: string;
}) {
  const baseUrl = cleanBaseUrl(config.baseUrl || "");
  const apiKey = config.apiKey?.trim();

  if (!baseUrl || !apiKey) {
    return {
      ok: false,
      status: 0,
      message: "Informe URL base e API key antes de testar.",
    };
  }

  const startedAt = Date.now();
  const endpoints = [
    { path: "/whatsapp/1/senders", method: "GET" },
    { path: "/whatsapp/1/message/text", method: "OPTIONS" },
    { path: "/sms/2/text/advanced", method: "OPTIONS" },
  ];

  try {
    const attempts = [];

    for (const endpoint of endpoints) {
      const res = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          Authorization: `App ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const responseText = await res.text();
      let details: any = null;

      try {
        details = responseText ? JSON.parse(responseText) : null;
      } catch {
        details = responseText;
      }

      attempts.push({
        endpoint: endpoint.path,
        status: res.status,
        ok: res.ok,
        details: summarizeInfobipDetails(details),
      });

      if (res.ok || res.status === 405) {
        const syncedSenders =
          endpoint.path === "/whatsapp/1/senders" && res.ok
            ? await saveInfobipSendersFromDetails(details)
            : [];

        return {
          ok: true,
          status: res.status,
          latencyMs: Date.now() - startedAt,
          message: "A URL base respondeu e a API aceitou a chamada.",
          details: summarizeInfobipDetails(details, syncedSenders),
          senders: syncedSenders.length ? syncedSenders : undefined,
          attempts,
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          status: res.status,
          latencyMs: Date.now() - startedAt,
          message:
            "A Infobip respondeu, mas recusou a API key. Cole a chave sem o prefixo App e confira as permissões.",
          details: summarizeInfobipDetails(details),
          attempts,
        };
      }
    }

    return {
      ok: false,
      status: attempts[0]?.status || 0,
      latencyMs: Date.now() - startedAt,
      message:
        "A URL respondeu, mas nenhum endpoint de teste confirmou a credencial.",
      attempts,
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      message: error?.message || "Não foi possível conectar na Infobip.",
    };
  }
}
