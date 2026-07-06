import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface DaySummary {
  date: string;
  totalMinutes: number;
  lunchMinutes: number;
  workMinutes: number;
  entries: { type: string; timestamp: string }[];
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") === "month" ? "month" : "week";
  const userId = searchParams.get("userId");

  const now = new Date();
  const year = parseInt(searchParams.get("year") || "") || now.getFullYear();
  const month =
    parseInt(searchParams.get("month") || "") || now.getMonth() + 1; // 1-12

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const whereClause: { timestamp: { gte: Date; lt: Date }; userId?: string } = {
    timestamp: { gte: monthStart, lt: monthEnd },
  };
  if (userId) whereClause.userId = userId;

  const employees = await prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
      active: true,
      ...(userId ? { id: userId } : {}),
    },
    select: {
      id: true,
      name: true,
      monthlySalary: true,
    },
  });

  const entries = await prisma.timeEntry.findMany({
    where: whereClause,
    orderBy: { timestamp: "asc" },
  });

  function buildReport(rangeStart: Date, rangeEnd: Date) {
    return employees.map((employee) => {
      const employeeEntries = entries.filter(
        (e) =>
          e.userId === employee.id &&
          e.timestamp >= rangeStart &&
          e.timestamp < rangeEnd
      );
      const dailySummaries = computeDailySummaries(employeeEntries);
      const totalWorkMinutes = dailySummaries.reduce(
        (sum, d) => sum + d.workMinutes,
        0
      );
      return {
        employee,
        dailySummaries,
        totalWorkMinutes,
        totalWorkHours: Math.round((totalWorkMinutes / 60) * 100) / 100,
      };
    });
  }

  const groups: {
    label: string;
    startDate: string;
    endDate: string;
    report: ReturnType<typeof buildReport>;
  }[] = [];

  if (period === "month") {
    groups.push({
      label: "Mes completo",
      startDate: monthStart.toISOString(),
      endDate: monthEnd.toISOString(),
      report: buildReport(monthStart, monthEnd),
    });
  } else {
    // Split the month into Monday-anchored weeks, clamped to the month bounds.
    let cursor = new Date(monthStart);
    let weekNum = 1;
    while (cursor < monthEnd) {
      const dayOfWeek = cursor.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const weekEnd = new Date(cursor);
      weekEnd.setDate(cursor.getDate() + daysUntilSunday + 1); // exclusive end (next Monday)
      const clampedEnd = weekEnd < monthEnd ? weekEnd : monthEnd;

      groups.push({
        label: `Semana ${weekNum}`,
        startDate: cursor.toISOString(),
        endDate: clampedEnd.toISOString(),
        report: buildReport(cursor, clampedEnd),
      });

      cursor = clampedEnd;
      weekNum++;
    }
  }

  return NextResponse.json({ period, year, month, groups });
}

function computeDailySummaries(
  entries: { type: string; timestamp: Date }[]
): DaySummary[] {
  const byDate = new Map<string, { type: string; timestamp: Date }[]>();

  for (const entry of entries) {
    const dateKey = entry.timestamp.toISOString().split("T")[0];
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(entry);
  }

  const summaries: DaySummary[] = [];

  for (const [date, dayEntries] of byDate) {
    const sorted = dayEntries.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    let totalMinutes = 0;
    let lunchMinutes = 0;
    let clockInTime: Date | null = null;
    let lunchOutTime: Date | null = null;

    for (const entry of sorted) {
      switch (entry.type) {
        case "CLOCK_IN":
          clockInTime = entry.timestamp;
          break;
        case "LUNCH_OUT":
          if (clockInTime) {
            totalMinutes += (entry.timestamp.getTime() - clockInTime.getTime()) / 60000;
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
            totalMinutes += (entry.timestamp.getTime() - clockInTime.getTime()) / 60000;
            clockInTime = null;
          }
          break;
      }
    }

    summaries.push({
      date,
      totalMinutes: Math.round(totalMinutes + lunchMinutes),
      lunchMinutes: Math.round(lunchMinutes),
      workMinutes: Math.round(totalMinutes),
      entries: sorted.map((e) => ({
        type: e.type,
        timestamp: e.timestamp.toISOString(),
      })),
    });
  }

  return summaries;
}
