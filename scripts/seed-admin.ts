import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "admin@admin.com";
  const password = "123456";
  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.$executeRaw`
    INSERT INTO "User" ("id", "name", "email", "password", "role", "createdAt")
    VALUES (
      'usr_' || replace(gen_random_uuid()::text, '-', ''),
      'Admin',
      ${email},
      ${hashedPassword},
      'admin',
      now()
    )
    ON CONFLICT ("email")
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "password" = EXCLUDED."password",
      "role" = EXCLUDED."role",
      "clientId" = NULL
  `;

  console.log("Admin criado:");
  console.log("Email:", email);
  console.log("Senha:", password);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
