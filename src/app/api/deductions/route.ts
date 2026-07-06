import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const DEDUCTION_TYPES = [
  "AFP",
  "COMISION_AFP",
  "ADELANTO",
  "DEUDAS",
  "COMPRA_PRODUCTO",
] as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const userId = searchParams.get("userId");

  const where: { year?: number; month?: number; userId?: string } = {};
  if (yearParam) where.year = parseInt(yearParam);
  if (monthParam) where.month = parseInt(monthParam);
  if (userId) where.userId = userId;

  const deductions = await prisma.deduction.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(deductions);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, type, amount, note, year, month } = body as {
    userId: string;
    type: string;
    amount: number;
    note?: string;
    year: number;
    month: number;
  };

  if (!userId || !type || amount == null || !year || !month) {
    return NextResponse.json(
      { error: "userId, type, amount, year y month son requeridos" },
      { status: 400 }
    );
  }
  if (!DEDUCTION_TYPES.includes(type as (typeof DEDUCTION_TYPES)[number])) {
    return NextResponse.json({ error: "Tipo de descuento inválido" }, { status: 400 });
  }
  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "El monto debe ser mayor a 0" },
      { status: 400 }
    );
  }

  const employee = await prisma.user.findFirst({
    where: { id: userId, role: "EMPLOYEE" },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  const deduction = await prisma.deduction.create({
    data: {
      userId,
      type,
      amount,
      note: note?.trim() || null,
      year,
      month,
    },
  });

  return NextResponse.json(deduction, { status: 201 });
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
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  await prisma.deduction.delete({ where: { id } });

  return NextResponse.json({ message: "Descuento eliminado" });
}
