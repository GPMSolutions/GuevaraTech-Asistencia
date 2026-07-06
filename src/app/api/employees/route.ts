import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const employees = await prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    select: {
      id: true,
      name: true,
      email: true,
      monthlySalary: true,
      active: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(employees);
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
  const { name, monthlySalary } = body as {
    name: string;
    monthlySalary?: number;
  };

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "El nombre es requerido" },
      { status: 400 }
    );
  }

  // Employees no longer log in individually (they use the shared kiosk), but the
  // User model still requires a unique email + password, so we generate internal
  // placeholders that are never used for authentication.
  const internalEmail = `empleado-${randomUUID()}@guevaratech.local`;
  const hashedPassword = await hash(randomUUID(), 12);

  const employee = await prisma.user.create({
    data: {
      name: name.trim(),
      email: internalEmail,
      password: hashedPassword,
      role: "EMPLOYEE",
      monthlySalary:
        typeof monthlySalary === "number" && monthlySalary >= 0
          ? monthlySalary
          : 1130.0,
    },
    select: {
      id: true,
      name: true,
      email: true,
      monthlySalary: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json(employee, { status: 201 });
}
