export type InfobipSender = {
  sender: string;
  displayName: string | null;
  status: string | null;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function normalizeSenderNumber(value: unknown) {
  return asString(value).replace(/\D/g, "");
}

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function pickArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const record = asRecord(payload);
  for (const key of ["senders", "items", "results", "data"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

export function getInfobipEnvConfig() {
  const baseUrl = cleanBaseUrl(process.env.INFOBIP_BASE_URL || "");
  const apiKey = (process.env.INFOBIP_API_KEY || "").trim();

  return {
    baseUrl,
    apiKey,
    configured: Boolean(baseUrl && apiKey),
  };
}

export function extractInfobipSenders(payload: unknown): InfobipSender[] {
  return pickArray(payload)
    .map((item) => {
      const record = asRecord(item);
      const profile = asRecord(record.profile);
      const sender = normalizeSenderNumber(
        record.sender || record.number || record.phoneNumber || record.from
      );

      if (!sender) return null;

      const displayName =
        asString(record.displayName) ||
        asString(record.name) ||
        asString(record.businessName) ||
        asString(profile.name) ||
        null;

      const status =
        asString(record.status) ||
        asString(record.state) ||
        (record.testSender ? "testSender" : null);

      return {
        sender,
        displayName,
        status,
      };
    })
    .filter((sender): sender is InfobipSender => Boolean(sender));
}

export async function fetchInfobipSenders() {
  const config = getInfobipEnvConfig();

  if (!config.configured) {
    throw new Error("Configure INFOBIP_BASE_URL e INFOBIP_API_KEY no .env.");
  }

  const res = await fetch(`${config.baseUrl}/whatsapp/1/senders`, {
    method: "GET",
    headers: {
      Authorization: `App ${config.apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      asString(asRecord(payload).message) ||
      asString(asRecord(payload).error) ||
      text ||
      `Infobip respondeu com HTTP ${res.status}.`;

    throw new Error(message);
  }

  return extractInfobipSenders(payload);
}
