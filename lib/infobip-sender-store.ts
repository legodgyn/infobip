import { prisma } from "@/lib/prisma";
import type { InfobipSender } from "@/lib/infobip-senders";

type SenderRow = {
  sender?: string | null;
  number?: string | null;
  displayName?: string | null;
  label?: string | null;
  status?: string | null;
};

export async function ensureInfobipSenderTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InfobipSender" (
      "id" TEXT PRIMARY KEY,
      "sender" TEXT NOT NULL UNIQUE,
      "displayName" TEXT,
      "status" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
    )
  `);
}

export async function upsertInfobipSenders(senders: InfobipSender[]) {
  await ensureInfobipSenderTable();

  for (const sender of senders) {
    await prisma.$executeRaw`
      INSERT INTO "InfobipSender" ("id", "sender", "displayName", "status", "createdAt", "updatedAt")
      VALUES (
        'is_' || replace(gen_random_uuid()::text, '-', ''),
        ${sender.sender},
        ${sender.displayName},
        ${sender.status},
        now(),
        now()
      )
      ON CONFLICT ("sender")
      DO UPDATE SET
        "displayName" = EXCLUDED."displayName",
        "status" = EXCLUDED."status",
        "updatedAt" = now()
    `;
  }
}

export async function listStoredInfobipSenders() {
  try {
    await ensureInfobipSenderTable();

    return await prisma.$queryRaw<SenderRow[]>`
      SELECT "sender", "displayName", "status"
      FROM "InfobipSender"
      ORDER BY "displayName" NULLS LAST, "sender"
    `;
  } catch {
    return [];
  }
}
