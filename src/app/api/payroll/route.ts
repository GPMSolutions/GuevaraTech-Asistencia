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
  const employeeId = searchParams.get("employeeId");

  const now = new Date();
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

  // Get employees
  const whereClause: { role: string; active: boolean; id?: string } = {
    role: "EMPLOYEE",
    active: true,
  };
  if (employeeId) whereClause.id = employeeId;

  const employees = await prisma.user.findMany({
    where: whereClause,
    select: { id: true, name: true, monthlySalary: true },
  });

  // Get time entries from the start of the year through the selected month.
  // Entries before the selected month are used to accumulate the hours bank.
  const yearStart = new Date(year, 0, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      timestamp: { gte: yearStart, lte: endDate },
      ...(employeeId ? { userId: employeeId } : {}),
    },
    orderBy: { timestamp: "asc" },
  });

  const deductions = await prisma.deduction.findMany({
    where: {
      year,
      month,
      ...(employeeId ? { userId: employeeId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Group entries by user and date
  const results = employees.map((emp) => {
    const empEntries = timeEntries.filter((e) => e.userId === emp.id);
    const attendanceMap = buildAttendanceMap(empEntries);

    const base = calculatePayroll(
      emp.id,
      emp.name,
      emp.monthlySalary,
      year,
      month,
      attendanceMap
    );

    // Accumulate the hours bank across every month of the year up to and
    // including the selected month (calculatePayroll only reads the days of
    // the month it is asked about, so the same map can be reused per month).
    let accumulatedBankMinutes = 0;
    for (let m = 1; m <= month; m++) {
      const monthResult = calculatePayroll(
        emp.id,
        emp.name,
        emp.monthlySalary,
        year,
        m,
        attendanceMap
      );
      accumulatedBankMinutes += monthResult.bankMinutes;
    }

    const empDeductions = deductions.filter((d) => d.userId === emp.id);
    const totalDeductions = empDeductions.reduce((sum, d) => sum + d.amount, 0);
    const netPay = base.totalPay - totalDeductions;

    return {
      ...base,
      accumulatedBankMinutes,
      deductions: empDeductions,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      netPay: Math.round(netPay * 100) / 100,
    };
  });

  return NextResponse.json({ year, month, payroll: results });
}

function buildAttendanceMap(
  entries: { type: string; timestamp: Date }[]
): Map<string, { present: boolean; workedMinutes: number; lunchMinutes: number }> {
  const map = new Map<string, { present: boolean; workedMinutes: number; lunchMinutes: number }>();

  // Group by date
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
