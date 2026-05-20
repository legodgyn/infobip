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

  await prisma.user.deleteMany({
    where: { email },
  });

  const user = await prisma.user.create({
    data: {
      name: "Admin",
      email,
      password: hashedPassword,
      role: "admin",
    },
  });

  console.log("Admin resetado:");
  console.log({
    id: user.id,
    email,
    password,
    hash: hashedPassword,
  });

  const test = await bcrypt.compare(password, hashedPassword);
  console.log("Teste bcrypt:", test);
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