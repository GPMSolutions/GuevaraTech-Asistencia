import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role !== "KIOSK" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const employees = await prisma.user.findMany({
    where: { role: "EMPLOYEE", active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEntries = await prisma.timeEntry.findMany({
    where: { timestamp: { gte: todayStart } },
    orderBy: { timestamp: "desc" },
    select: { userId: true, type: true },
  });

  const lastTypeByUser = new Map<string, string>();
  for (const entry of todayEntries) {
    if (!lastTypeByUser.has(entry.userId)) {
      lastTypeByUser.set(entry.userId, entry.type);
    }
  }

  const result = employees.map((emp) => ({
    id: emp.id,
    name: emp.name,
    lastType: lastTypeByUser.get(emp.id) ?? null,
  }));

  return NextResponse.json(result);
}
