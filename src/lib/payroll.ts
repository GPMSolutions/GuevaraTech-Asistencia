/**
 * Payroll calculation for Peru labor rules.
 *
 * Rules:
 * - Monthly salary: S/ 1,130.00 (configurable per employee)
 * - Daily rate = monthlySalary / daysInMonth
 * - Work schedule: Mon-Sat, 8 hours/day, 48 hours/week
 * - Regular pay uses a monthly hours pool over the days actually worked: their
 *   worked minutes on regular (non-holiday) Mon-Sat days are summed WITHOUT a
 *   per-day cap, so extra minutes on one day cover short minutes on another day
 *   anywhere in the month. Pay is the pool capped at 8h per worked day; it never
 *   exceeds a full 8h day of pay per worked day.
 * - Hours bank ("horas a favor"): a running balance carried across months.
 *   Extra minutes over 8h add to it; short days first spend this month's extra
 *   and then the carried-in balance so the day is still paid full. Whatever is
 *   left rolls forward to the next month. Pay never exceeds 8h per worked day.
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
  /** Expected minutes for the month: 8h × number of regular days worked. */
  targetRegularMinutes: number;
  /** Regular minutes actually paid this month (bank + worked, capped at target). */
  paidRegularMinutes: number;
  /**
   * Hours bank balance carried forward AFTER this month: the incoming bank plus
   * this month's extra minutes, minus whatever was used to top up short days.
   * These minutes are not paid until used; the balance rolls into next month.
   */
  bankMinutes: number;
}

/**
 * Calculate payroll for an employee for a given month.
 *
 * @param monthlySalary - Employee's monthly salary (default S/ 1,130.00)
 * @param year - Year
 * @param month - Month (1-12)
 * @param attendanceRecords - Map of date key (YYYY-MM-DD) to { present, workedMinutes, lunchMinutes }
 * @param bankStartMinutes - Hours bank balance carried in from previous months.
 *   It is added to this month's worked minutes so it can cover short days; the
 *   leftover (bankMinutes) is the balance carried forward to next month.
 */
export function calculatePayroll(
  employeeId: string,
  employeeName: string,
  monthlySalary: number,
  year: number,
  month: number,
  attendanceRecords: Map<string, { present: boolean; workedMinutes: number; lunchMinutes: number }>,
  bankStartMinutes: number = 0
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
  let totalHolidayBonus = 0;
  let totalWorkedMinutes = 0;

  // Hours-bank pooling: total the worked minutes of all regular (non-holiday,
  // Mon-Sat) days WITHOUT a per-day cap, so extra hours on one day fill in
  // short hours on another day anywhere in the month. Regular pay is then
  // based on the pool, capped at the full monthly schedule (8h × those days).
  // Holidays are handled separately (always paid; worked holidays earn 3x).
  let pooledWorkedMinutes = 0;
  let scheduledRegularDays = 0;
  let holidayRegularPay = 0;

  for (const day of attendance) {
    if (day.isSunday) continue;

    if (day.isHoliday) {
      if (day.present) {
        totalDaysWorked++;
        totalWorkedMinutes += day.workedMinutes;
        // Worked holiday: proportional regular pay + 2x bonus on hours worked.
        const holidayFraction = Math.min(day.workedMinutes / STANDARD_DAY_MINUTES, 1);
        holidayRegularPay += dailyRate * holidayFraction;
        totalHolidayBonus += dailyRate * 2 * holidayFraction;
      } else {
        // Holidays are ALWAYS paid in full even if the employee didn't work.
        holidayRegularPay += dailyRate;
      }
      continue;
    }

    // Regular (non-holiday) Mon-Sat day: only days the employee actually
    // worked count toward the pool and the expected schedule. A worked day is
    // expected to be 8h, so the bank is the net over/under across worked days.
    // Absences simply don't count (they neither pay nor touch the bank).
    if (day.present) {
      scheduledRegularDays++;
      totalDaysWorked++;
      totalWorkedMinutes += day.workedMinutes;
      pooledWorkedMinutes += day.workedMinutes;
    }
  }

  // Expected minutes = 8h for every day actually worked this month.
  const targetRegularMinutes = scheduledRegularDays * STANDARD_DAY_MINUTES;

  // The bank carried in from previous months is available to cover short days
  // this month. We pay up to a full 8h for each worked day (never more), using
  // this month's worked minutes plus the bank. Whatever is left over is the new
  // bank balance carried forward to next month.
  const availableMinutes = Math.round(bankStartMinutes + pooledWorkedMinutes);
  const paidRegularMinutes = Math.min(availableMinutes, targetRegularMinutes);
  const bankMinutes = Math.max(0, availableMinutes - paidRegularMinutes);

  const totalRegularPay =
    (paidRegularMinutes / STANDARD_DAY_MINUTES) * dailyRate + holidayRegularPay;

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
    targetRegularMinutes,
    paidRegularMinutes,
    bankMinutes,
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
