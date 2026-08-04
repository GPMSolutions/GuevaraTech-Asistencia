/**
 * Payroll calculation for Peru labor rules.
 *
 * This mirrors the customer's Excel exactly (Control de Asistencia):
 * - Monthly salary: S/ 1,130.00 (configurable per employee).
 * - Daily rate = monthlySalary / daysInMonth; per-minute rate = dailyRate / 480.
 * - Work schedule: Mon-Sat, 8h/day. Sundays and holidays are paid rest days
 *   already covered by the monthly salary.
 * - Regular + Dominical together equal the full monthly salary when the employee
 *   attends every working day. Concretely:
 *     - Regular pay  = (present Mon-Sat working days + holidays in the month) × dailyRate.
 *       Holidays are paid whether worked or not; an absent working day is simply
 *       not counted (it lowers pay by one dailyRate). Short days (present but
 *       under 8h) are NOT docked — the month is still paid full.
 *     - Dominical pay = (Sundays whose week had attendance) × dailyRate. Each
 *       Sunday is paid in full; there is no daysWorked/6 proration.
 * - Bono Feriado: a worked holiday earns an extra 2 × workedMinutes × per-minute
 *   rate (no 8h cap), on top of the day already being paid via the salary.
 * - Horas a favor ("banco"): this month's surplus only, NOT carried across
 *   months — the net of (workedMinutes − 8h) summed over the present working
 *   days. It is shown for information and never added to pay.
 * - No attendance at all in the month ⇒ everything is 0 (holidays alone do not pay).
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
  /** Expected minutes for the month: 8h × number of days worked (info only). */
  targetRegularMinutes: number;
  /** Minutes actually worked toward the schedule (info only). */
  paidRegularMinutes: number;
  /**
   * Horas a favor for THIS month only (not carried forward): the net of
   * (workedMinutes − 8h) summed over the present working days. Shown for
   * information; never added to pay.
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
  const perMinuteRate = dailyRate / STANDARD_DAY_MINUTES;

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

  // Which ISO weeks have any attendance — a Sunday is only paid if its week
  // was worked (so a fully-absent employee earns no Sunday pay).
  const weekHasAttendance = new Set<string>();
  for (const day of attendance) {
    if (!day.isSunday && day.present) {
      weekHasAttendance.add(getWeekMonday(day.date));
    }
  }

  let totalDaysWorked = 0;
  let totalHolidayBonus = 0;
  let totalWorkedMinutes = 0;
  let presentWorkingDays = 0; // present Mon-Sat, non-holiday
  let holidayDaysInMonth = 0; // holidays on Mon-Sat, paid whether worked or not
  let creditedSundays = 0; // Sundays whose week had attendance
  let surplusMinutes = 0; // net (worked − 8h) over present working days

  for (const day of attendance) {
    if (day.isSunday) {
      // Each Sunday whose week was worked is paid a full daily rate.
      if (weekHasAttendance.has(getWeekMonday(day.date))) {
        creditedSundays++;
      }
      continue;
    }

    if (day.isHoliday) {
      // Holidays are paid rest days (covered by the monthly salary). If worked,
      // they earn an extra 2 × workedMinutes at the per-minute rate.
      holidayDaysInMonth++;
      if (day.present) {
        totalDaysWorked++;
        totalWorkedMinutes += day.workedMinutes;
        totalHolidayBonus += 2 * day.workedMinutes * perMinuteRate;
      }
      continue;
    }

    // Regular Mon-Sat working day.
    if (day.present) {
      presentWorkingDays++;
      totalDaysWorked++;
      totalWorkedMinutes += day.workedMinutes;
      surplusMinutes += day.workedMinutes - STANDARD_DAY_MINUTES;
    }
  }

  const hasAttendance = totalDaysWorked > 0;

  // Regular = worked working days + all holidays (paid whether worked or not),
  // at one daily rate each. Dominical = full daily rate per credited Sunday.
  // Together they equal the full monthly salary for a fully-attended month.
  const totalRegularPay = hasAttendance
    ? (presentWorkingDays + holidayDaysInMonth) * dailyRate
    : 0;
  const totalSundayPay = hasAttendance ? creditedSundays * dailyRate : 0;

  // Horas a favor: this month's surplus only (never carried forward).
  const bankMinutes = hasAttendance ? surplusMinutes : 0;

  const weeks = calculateWeeks(attendance, dailyRate, weekHasAttendance);

  const targetRegularMinutes = totalDaysWorked * STANDARD_DAY_MINUTES;
  const paidRegularMinutes = totalWorkedMinutes;
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
 * Per-week breakdown (informational). Each in-month Sunday whose week had any
 * attendance is paid a full daily rate — matching the customer's Excel.
 */
function calculateWeeks(
  attendance: DailyAttendance[],
  dailyRate: number,
  weekHasAttendance: Set<string>
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
    const presentDays = days.filter((d) => !d.isSunday && d.present);
    const daysWorked = presentDays.length;

    // Each in-month Sunday is paid a full daily rate when its week was worked.
    const sundayPay =
      sundayInMonth && weekHasAttendance.has(weekKey) ? dailyRate : 0;

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
