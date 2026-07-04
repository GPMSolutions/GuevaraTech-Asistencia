/**
 * Payroll calculation for Peru labor rules.
 *
 * Rules:
 * - Monthly salary: S/ 1,130.00 (configurable per employee)
 * - Daily rate = monthlySalary / daysInMonth
 * - Work schedule: Mon-Sat, 8 hours/day, 48 hours/week
 * - Sunday pay: proportional to days worked in the week
 *   (e.g., 6/6 days = full Sunday pay, 5/6 = 5/6 of daily rate)
 * - Holiday pay: if employee works on a holiday, they earn 3x daily rate
 *   (regular day + 2 extra days)
 */

import { isPeruHoliday, getDaysInMonth } from "./holidays";

export interface DailyAttendance {
  date: Date;
  dateKey: string;
  present: boolean;
  workedMinutes: number;
  lunchMinutes: number;
  isHoliday: boolean;
  holidayName?: string;
  isSunday: boolean;
}

export interface WeekSummary {
  weekStart: string; // Monday date key
  weekEnd: string; // Saturday date key
  daysWorked: number; // out of 6 (Mon-Sat)
  sundayPay: number;
}

export interface PayrollResult {
  employeeId: string;
  employeeName: string;
  month: number; // 1-12
  year: number;
  monthlySalary: number;
  daysInMonth: number;
  dailyRate: number;
  attendance: DailyAttendance[];
  weeks: WeekSummary[];
  totalDaysWorked: number;
  totalRegularPay: number;
  totalSundayPay: number;
  totalHolidayBonus: number;
  totalPay: number;
  totalWorkedMinutes: number;
}

/**
 * Calculate payroll for an employee for a given month.
 *
 * @param monthlySalary - Employee's monthly salary (default S/ 1,130.00)
 * @param year - Year
 * @param month - Month (1-12)
 * @param attendanceRecords - Map of date key (YYYY-MM-DD) to { present, workedMinutes, lunchMinutes }
 */
export function calculatePayroll(
  employeeId: string,
  employeeName: string,
  monthlySalary: number,
  year: number,
  month: number,
  attendanceRecords: Map<string, { present: boolean; workedMinutes: number; lunchMinutes: number }>
): PayrollResult {
  const daysInMonth = getDaysInMonth(year, month);
  const dailyRate = monthlySalary / daysInMonth;

  const attendance: DailyAttendance[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dateKey = formatDateKey(date);
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
    const isSunday = dayOfWeek === 0;
    const holiday = isPeruHoliday(date);

    const record = attendanceRecords.get(dateKey);
    const present = record?.present ?? false;

    attendance.push({
      date,
      dateKey,
      present,
      workedMinutes: record?.workedMinutes ?? 0,
      lunchMinutes: record?.lunchMinutes ?? 0,
      isHoliday: holiday.isHoliday,
      holidayName: holiday.name,
      isSunday,
    });
  }

  // Calculate weekly summaries for Sunday pay
  const weeks = calculateWeeks(attendance, dailyRate, year, month);

  // Calculate totals
  let totalDaysWorked = 0;
  let totalRegularPay = 0;
  let totalHolidayBonus = 0;
  let totalWorkedMinutes = 0;

  for (const day of attendance) {
    if (day.isSunday) continue;

    if (day.present) {
      totalDaysWorked++;
      totalWorkedMinutes += day.workedMinutes;

      if (day.isHoliday) {
        // Holiday worked: 3x daily rate (1 regular + 2 extra)
        totalRegularPay += dailyRate;
        totalHolidayBonus += dailyRate * 2;
      } else {
        totalRegularPay += dailyRate;
      }
    } else if (day.isHoliday && day.date.getDay() !== 0) {
      // Holidays are ALWAYS paid even if employee didn't work that week
      totalRegularPay += dailyRate;
    }
  }

  const totalSundayPay = weeks.reduce((sum, w) => sum + w.sundayPay, 0);
  const totalPay = totalRegularPay + totalSundayPay + totalHolidayBonus;

  return {
    employeeId,
    employeeName,
    month,
    year,
    monthlySalary,
    daysInMonth,
    dailyRate,
    attendance,
    weeks,
    totalDaysWorked,
    totalRegularPay,
    totalSundayPay,
    totalHolidayBonus,
    totalPay,
    totalWorkedMinutes,
  };
}

/**
 * Calculate Sunday pay based on days worked Mon-Sat each week.
 */
function calculateWeeks(
  attendance: DailyAttendance[],
  dailyRate: number,
  _year: number,
  _month: number
): WeekSummary[] {
  const weeks: WeekSummary[] = [];

  // Group days into ISO weeks (Mon-Sun)
  const weekMap = new Map<string, { days: DailyAttendance[]; sundayInMonth: boolean }>();

  for (const day of attendance) {
    const weekKey = getWeekMonday(day.date);
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { days: [], sundayInMonth: false });
    }
    const week = weekMap.get(weekKey)!;
    week.days.push(day);
    if (day.isSunday) {
      week.sundayInMonth = true;
    }
  }

  for (const [weekKey, { days, sundayInMonth }] of weekMap) {
    // Count workdays (Mon-Sat) where employee was present
    const workDays = days.filter(
      (d) => !d.isSunday && d.present
    );
    // Holidays (not worked) also count as "days worked" for Sunday calculation
    const holidayDays = days.filter(
      (d) => !d.isSunday && !d.present && d.isHoliday
    );
    const daysWorked = workDays.length + holidayDays.length;

    // Sunday pay is incremental: (daysWorked / 6) * dailyRate
    // 1 day = 1/6, 2 days = 2/6, ..., 6 days = full daily rate
    // 0 days worked (and no holidays) = no Sunday pay
    let sundayPay = 0;
    if (sundayInMonth && daysWorked > 0) {
      sundayPay = (daysWorked / 6) * dailyRate;
    }

    const saturdayDates = days.filter((d) => d.date.getDay() === 6);
    const weekEnd = saturdayDates.length > 0
      ? formatDateKey(saturdayDates[0].date)
      : weekKey;

    weeks.push({
      weekStart: weekKey,
      weekEnd,
      daysWorked,
      sundayPay: Math.round(sundayPay * 100) / 100,
    });
  }

  return weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

function getWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDateKey(d);
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
