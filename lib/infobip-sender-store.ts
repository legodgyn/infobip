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

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "InfobipSender"
    ADD COLUMN IF NOT EXISTS "id" TEXT,
    ADD COLUMN IF NOT EXISTS "displayName" TEXT,
    ADD COLUMN IF NOT EXISTS "status" TEXT,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "InfobipSender"
    SET "id" = 'is_' || replace(gen_random_uuid()::text, '-', '')
    WHERE "id" IS NULL OR "id" = ''
  `);
}

export async function upsertInfobipSenders(senders: InfobipSender[]) {
  await ensureInfobipSenderTable();

  for (const sender of senders) {
    await prisma.$executeRaw`
      UPDATE "InfobipSender"
      SET
        "displayName" = ${sender.displayName},
        "status" = ${sender.status},
        "updatedAt" = now()
      WHERE "sender" = ${sender.sender}
    `;

    await prisma.$executeRaw`
      INSERT INTO "InfobipSender" ("id", "sender", "displayName", "status", "createdAt", "updatedAt")
      SELECT
        'is_' || replace(gen_random_uuid()::text, '-', ''),
        ${sender.sender},
        ${sender.displayName},
        ${sender.status},
        now(),
        now()
      WHERE NOT EXISTS (
        SELECT 1 FROM "InfobipSender" WHERE "sender" = ${sender.sender}
      )
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
