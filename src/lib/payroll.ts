/**
 * Payroll calculation for Peru labor rules.
 *
 * Rules:
 * - Monthly salary: S/ 1,130.00 (configurable per employee)
 * - Daily rate = monthlySalary / daysInMonth
 * - Regular daily pay is proportional to hours worked, capped at 8h/day
 *   (a half day pays half the daily rate; hours beyond 8 do not add to regular pay)
 * - Work schedule: Mon-Sat, 8 hours/day, 48 hours/week
 * - Sunday pay: proportional to hours worked in the week (fractional days,
 *   each capped at 8h). 6 full days = full Sunday pay; a half day counts as 0.5
 * - Holiday pay: if employee works on a holiday, they earn 3x daily rate
 *   (regular day + 2 extra days)
 */

import { isPeruHoliday, getDaysInMonth } from "./holidays";

/** Minutes in a standard workday (8 hours) used to prorate daily pay. */
const STANDARD_DAY_MINUTES = 8 * 60;

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

      // Regular pay is proportional to hours actually worked, capped at a
      // full standard workday (8h). A half day pays half a daily rate; hours
      // beyond 8 do not increase regular pay (they accrue as overtime/banked).
      const dayFraction = Math.min(day.workedMinutes / STANDARD_DAY_MINUTES, 1);

      if (day.isHoliday) {
        // Holiday worked: proportional regular pay + 2x bonus on hours worked.
        totalRegularPay += dailyRate * dayFraction;
        totalHolidayBonus += dailyRate * 2 * dayFraction;
      } else {
        totalRegularPay += dailyRate * dayFraction;
      }
    } else if (day.isHoliday && day.date.getDay() !== 0) {
      // Holidays are ALWAYS paid in full even if employee didn't work that week
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
    // Count workdays (Mon-Sat) where employee was actually present.
    // A worked holiday is present, so it's already included here.
    // Holidays that were NOT worked do not count toward Sunday pay.
    const presentDays = days.filter((d) => !d.isSunday && d.present);
    const daysWorked = presentDays.length;

    // Fractional days worked: each day counts by its hours (capped at 8h/day),
    // so a half day contributes 0.5. Sunday pay tracks actual hours worked.
    const fractionalDaysWorked = presentDays.reduce(
      (sum, d) => sum + Math.min(d.workedMinutes / STANDARD_DAY_MINUTES, 1),
      0
    );

    // Sunday pay is incremental and prorated by hours:
    // (fractionalDaysWorked / 6) * dailyRate, capped at a full daily rate.
    // 6 full days = full Sunday pay; 0 hours worked = no Sunday pay.
    let sundayPay = 0;
    if (sundayInMonth && fractionalDaysWorked > 0) {
      sundayPay = Math.min(fractionalDaysWorked / 6, 1) * dailyRate;
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
