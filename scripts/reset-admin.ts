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

  const users = await prisma.$queryRaw<
    Array<{ id: string; email: string; role: string }>
  >`
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
    RETURNING "id", "email", "role"::text AS "role"
  `;

  console.log("Admin pronto:");
  console.log({
    id: users[0]?.id,
    email,
    password,
    role: users[0]?.role,
    bcryptOk: await bcrypt.compare(password, hashedPassword),
  });
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
