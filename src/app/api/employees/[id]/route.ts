import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role === "ADMIN") {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ message: "Empleado eliminado" });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, password, name, active, monthlySalary } = body as {
    action?: string;
    password?: string;
    name?: string;
    active?: boolean;
    monthlySalary?: number;
  };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  // Reset password
  if (action === "reset_password") {
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }
    const hashedPassword = await hash(password, 12);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
    return NextResponse.json({ message: "Contraseña actualizada" });
  }

  // Update employee info
  const updateData: { name?: string; active?: boolean; monthlySalary?: number } = {};
  if (name !== undefined) updateData.name = name;
  if (active !== undefined) updateData.active = active;
  if (monthlySalary !== undefined) updateData.monthlySalary = monthlySalary;

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      monthlySalary: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json(updated);
}
