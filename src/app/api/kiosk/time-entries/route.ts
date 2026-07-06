import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["CLOCK_IN", "LUNCH_OUT", "LUNCH_IN", "CLOCK_OUT"];

function getAllowedActions(lastType: string | undefined): string[] {
  if (!lastType || lastType === "CLOCK_OUT") return ["CLOCK_IN"];
  switch (lastType) {
    case "CLOCK_IN":
      return ["LUNCH_OUT", "CLOCK_OUT"];
    case "LUNCH_OUT":
      return ["LUNCH_IN"];
    case "LUNCH_IN":
      return ["LUNCH_OUT", "CLOCK_OUT"];
    default:
      return ["CLOCK_IN"];
  }
}

function formatActionLabel(type: string): string {
  switch (type) {
    case "CLOCK_IN":
      return "Entrada";
    case "LUNCH_OUT":
      return "Salida Almuerzo";
    case "LUNCH_IN":
      return "Regreso Almuerzo";
    case "CLOCK_OUT":
      return "Salida";
    default:
      return type;
  }
}

function ensureKiosk(role: string | undefined): boolean {
  return role === "KIOSK" || role === "ADMIN";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ensureKiosk(session.user.role)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const entries = await prisma.timeEntry.findMany({
    where: { userId, timestamp: { gte: todayStart } },
    orderBy: { timestamp: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ensureKiosk(session.user.role)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, type } = body as { userId: string; type: string };

  if (!userId || !type) {
    return NextResponse.json(
      { error: "userId y type son requeridos" },
      { status: 400 }
    );
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Tipo de registro inválido" }, { status: 400 });
  }

  const employee = await prisma.user.findFirst({
    where: { id: userId, role: "EMPLOYEE", active: true },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEntries = await prisma.timeEntry.findMany({
    where: { userId, timestamp: { gte: todayStart } },
    orderBy: { timestamp: "desc" },
  });

  const allowedActions = getAllowedActions(todayEntries[0]?.type);
  if (!allowedActions.includes(type)) {
    return NextResponse.json(
      {
        error: `Acción no permitida. Permitidas: ${allowedActions
          .map(formatActionLabel)
          .join(", ")}`,
      },
      { status: 400 }
    );
  }

  const entry = await prisma.timeEntry.create({
    data: { userId, type, timestamp: new Date() },
  });

  return NextResponse.json(entry, { status: 201 });
}
