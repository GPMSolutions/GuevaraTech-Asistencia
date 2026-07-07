import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculatePayroll } from "@/lib/payroll";

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

  const now = new Date();
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

  const employees = await prisma.user.findMany({
    where: { role: "EMPLOYEE", active: true },
    select: { id: true, name: true, email: true, monthlySalary: true },
  });

  const yearStart = new Date(year, 0, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const timeEntries = await prisma.timeEntry.findMany({
    where: { timestamp: { gte: yearStart, lte: endDate } },
    orderBy: { timestamp: "asc" },
  });

  const deductions = await prisma.deduction.findMany({
    where: { year, month },
  });

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  // Build CSV
  const lines: string[] = [];
  lines.push("Empleado,Email,Salario Mensual,Dias Trabajados,Pago Regular,Pago Dominical,Bono Feriado,Total Bruto,Descuentos,Total a Pagar,Horas Trabajadas,Horas a Favor (Banco)");

  for (const emp of employees) {
    const empEntries = timeEntries.filter((e) => e.userId === emp.id);
    const attendanceMap = buildAttendanceMap(empEntries);

    const result = calculatePayroll(
      emp.id,
      emp.name,
      emp.monthlySalary,
      year,
      month,
      attendanceMap
    );

    let accumulatedBankMinutes = 0;
    for (let m = 1; m <= month; m++) {
      accumulatedBankMinutes += calculatePayroll(
        emp.id,
        emp.name,
        emp.monthlySalary,
        year,
        m,
        attendanceMap
      ).bankMinutes;
    }

    const hoursWorked = Math.round((result.totalWorkedMinutes / 60) * 100) / 100;
    const bankHours = Math.round((accumulatedBankMinutes / 60) * 100) / 100;
    const totalDeductions = deductions
      .filter((d) => d.userId === emp.id)
      .reduce((sum, d) => sum + d.amount, 0);
    const netPay = result.totalPay - totalDeductions;

    lines.push(
      [
        `"${emp.name}"`,
        emp.email,
        result.monthlySalary.toFixed(2),
        result.totalDaysWorked,
        result.totalRegularPay.toFixed(2),
        result.totalSundayPay.toFixed(2),
        result.totalHolidayBonus.toFixed(2),
        result.totalPay.toFixed(2),
        totalDeductions.toFixed(2),
        netPay.toFixed(2),
        hoursWorked.toFixed(2),
        bankHours.toFixed(2),
      ].join(",")
    );
  }

  const csv = lines.join("\n");
  const filename = `planilla_${monthNames[month - 1]}_${year}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function buildAttendanceMap(
  entries: { type: string; timestamp: Date }[]
): Map<string, { present: boolean; workedMinutes: number; lunchMinutes: number }> {
  const map = new Map<string, { present: boolean; workedMinutes: number; lunchMinutes: number }>();

  const byDate = new Map<string, { type: string; timestamp: Date }[]>();
  for (const entry of entries) {
    const dateKey = formatDateKey(entry.timestamp);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(entry);
  }

  for (const [dateKey, dayEntries] of byDate) {
    const sorted = dayEntries.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    let workedMinutes = 0;
    let lunchMinutes = 0;
    let clockInTime: Date | null = null;
    let lunchOutTime: Date | null = null;
    let present = false;

    for (const entry of sorted) {
      switch (entry.type) {
        case "CLOCK_IN":
          clockInTime = entry.timestamp;
          present = true;
          break;
        case "LUNCH_OUT":
          if (clockInTime) {
            workedMinutes += (entry.timestamp.getTime() - clockInTime.getTime()) / 60000;
            clockInTime = null;
          }
          lunchOutTime = entry.timestamp;
          break;
        case "LUNCH_IN":
          if (lunchOutTime) {
            lunchMinutes += (entry.timestamp.getTime() - lunchOutTime.getTime()) / 60000;
            lunchOutTime = null;
          }
          clockInTime = entry.timestamp;
          break;
        case "CLOCK_OUT":
          if (clockInTime) {
            workedMinutes += (entry.timestamp.getTime() - clockInTime.getTime()) / 60000;
            clockInTime = null;
          }
          break;
      }
    }

    map.set(dateKey, {
      present,
      workedMinutes: Math.round(workedMinutes),
      lunchMinutes: Math.round(lunchMinutes),
    });
  }

  return map;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
