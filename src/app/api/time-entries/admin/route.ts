import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, type, timestamp } = body as {
    userId: string;
    type: string;
    timestamp: string;
  };

  if (!userId || !type || !timestamp) {
    return NextResponse.json(
      { error: "userId, type y timestamp son requeridos" },
      { status: 400 }
    );
  }

  const validTypes = ["CLOCK_IN", "LUNCH_OUT", "LUNCH_IN", "CLOCK_OUT"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Tipo de registro inválido" }, { status: 400 });
  }

  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      type,
      timestamp: new Date(timestamp),
    },
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entryId = searchParams.get("id");

  if (!entryId) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  await prisma.timeEntry.delete({ where: { id: entryId } });

  return NextResponse.json({ message: "Registro eliminado" });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const body = await req.json();
  const { id, type, timestamp } = body as {
    id: string;
    type?: string;
    timestamp?: string;
  };

  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const validTypes = ["CLOCK_IN", "LUNCH_OUT", "LUNCH_IN", "CLOCK_OUT"];
  if (type && !validTypes.includes(type)) {
    return NextResponse.json({ error: "Tipo de registro inválido" }, { status: 400 });
  }

  const updateData: { type?: string; timestamp?: Date } = {};
  if (type) updateData.type = type;
  if (timestamp) updateData.timestamp = new Date(timestamp);

  const entry = await prisma.timeEntry.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(entry);
}
