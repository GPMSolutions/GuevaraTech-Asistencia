import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }
  return { error: null };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const kiosk = await prisma.user.findFirst({
    where: { role: "KIOSK" },
    select: { email: true, name: true },
  });

  if (!kiosk) {
    return NextResponse.json({ error: "Cuenta de kiosco no encontrada" }, { status: 404 });
  }

  return NextResponse.json(kiosk);
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { newPassword } = body as { newPassword?: string };

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const kiosk = await prisma.user.findFirst({
    where: { role: "KIOSK" },
    select: { id: true },
  });

  if (!kiosk) {
    return NextResponse.json({ error: "Cuenta de kiosco no encontrada" }, { status: 404 });
  }

  const hashedPassword = await hash(newPassword, 12);
  await prisma.user.update({
    where: { id: kiosk.id },
    data: { password: hashedPassword },
  });

  return NextResponse.json({ message: "Contraseña del kiosco actualizada" });
}
