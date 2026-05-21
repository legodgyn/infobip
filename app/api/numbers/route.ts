import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const number = await prisma.clientNumber.create({
    data: {
      clientId: body.clientId,
      number: String(body.number || "").replace(/\D/g, ""),
      label: body.label || null,
    },
  });

  return NextResponse.json(number);
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }

  await prisma.clientNumber.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}