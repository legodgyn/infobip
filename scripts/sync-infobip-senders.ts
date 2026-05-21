import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  fetchInfobipSenders,
  type InfobipSender,
} from "../lib/infobip-senders";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function ensureInfobipSenderTable() {
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

async function upsertSenders(senders: InfobipSender[]) {
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

async function main() {
  console.log("Buscando numeros na Infobip...");
  const senders = await fetchInfobipSenders();
  console.log(`Infobip retornou ${senders.length} numero(s). Salvando...`);

  await upsertSenders(senders);

  const total = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "InfobipSender"
  `;

  console.log(`Sincronizacao concluida. Total no banco: ${String(total[0]?.count || 0)}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
