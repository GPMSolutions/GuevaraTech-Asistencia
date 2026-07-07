import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculatePayroll, type PayrollResult } from "@/lib/payroll";

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

  // Get every time entry up to and including the selected month. Prior months
  // are needed because the hours bank is a running balance carried forward.
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      timestamp: { lte: endDate },
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

    // The hours bank is a running balance: replay every month from the first
    // one with attendance up to the selected month, carrying the balance
    // forward so earlier surplus can cover later short days.
    const { result: base, bankStart } = replayHoursBank(
      emp.id,
      emp.name,
      emp.monthlySalary,
      year,
      month,
      attendanceMap
    );
    const accumulatedBankMinutes = base.bankMinutes;
    const monthlyBankChange = base.bankMinutes - bankStart;

    const empDeductions = deductions.filter((d) => d.userId === emp.id);
    const totalDeductions = empDeductions.reduce((sum, d) => sum + d.amount, 0);
    const netPay = base.totalPay - totalDeductions;

    return {
      ...base,
      accumulatedBankMinutes,
      monthlyBankChange,
      deductions: empDeductions,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      netPay: Math.round(netPay * 100) / 100,
    };
  });

  return NextResponse.json({ year, month, payroll: results });
}

/**
 * Replay payroll month-by-month from the first month with attendance up to the
 * selected month, carrying the hours-bank balance forward each month. Returns
 * the selected month's payroll result and the bank balance it started with.
 */
function replayHoursBank(
  employeeId: string,
  employeeName: string,
  monthlySalary: number,
  year: number,
  month: number,
  attendanceMap: Map<string, { present: boolean; workedMinutes: number; lunchMinutes: number }>
): { result: PayrollResult; bankStart: number } {
  // Earliest month that has any attendance (defaults to the selected month).
  let startYear = year;
  let startMonth = month;
  for (const key of attendanceMap.keys()) {
    const [ky, km] = key.split("-").map(Number);
    if (ky < startYear || (ky === startYear && km < startMonth)) {
      startYear = ky;
      startMonth = km;
    }
  }

  let carried = 0;
  let bankStart = 0;
  let result: PayrollResult | null = null;
  let y = startYear;
  let m = startMonth;
  // Safety bound: at most ~10 years of months.
  for (let guard = 0; guard < 120; guard++) {
    bankStart = carried;
    result = calculatePayroll(
      employeeId,
      employeeName,
      monthlySalary,
      y,
      m,
      attendanceMap,
      carried
    );
    carried = result.bankMinutes;
    if (y === year && m === month) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return { result: result!, bankStart };
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
