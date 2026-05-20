import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const password = body.password || "123456";

  const hashedPassword = await bcrypt.hash(password, 10);

  const createdUser = await prisma.user.create({
    data: {
      name: body.name,
      email: String(body.email).toLowerCase().trim(),
      password: hashedPassword,
      role: "client",
      clientId: body.clientId,
    },
  });

  return NextResponse.json({
    id: createdUser.id,
    name: createdUser.name,
    email: createdUser.email,
    role: createdUser.role,
    clientId: createdUser.clientId,
  });
}