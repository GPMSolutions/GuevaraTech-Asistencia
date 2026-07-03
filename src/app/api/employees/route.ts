import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

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
  const { name, email, password } = body as {
    name: string;
    email: string;
    password: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Nombre, email y contraseña son requeridos" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe un usuario con ese email" },
      { status: 409 }
    );
  }

  const hashedPassword = await hash(password, 12);

  const employee = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "EMPLOYEE",
      monthlySalary: 1130.0,
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
