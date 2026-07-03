/**
 * Peru's 16 legal holidays (feriados de ley).
 * Includes fixed-date holidays and Easter-based movable holidays.
 */

interface HolidayDef {
  month: number; // 1-12
  day: number;
  name: string;
}

// 14 fixed holidays
const FIXED_HOLIDAYS: HolidayDef[] = [
  { month: 1, day: 1, name: "Año Nuevo" },
  { month: 5, day: 1, name: "Día del Trabajo" },
  { month: 6, day: 7, name: "Batalla de Arica" },
  { month: 6, day: 29, name: "San Pedro y San Pablo" },
  { month: 7, day: 23, name: "Día de la Fuerza Aérea del Perú" },
  { month: 7, day: 28, name: "Fiestas Patrias" },
  { month: 7, day: 29, name: "Fiestas Patrias" },
  { month: 8, day: 6, name: "Batalla de Junín" },
  { month: 8, day: 30, name: "Santa Rosa de Lima" },
  { month: 10, day: 8, name: "Combate de Angamos" },
  { month: 11, day: 1, name: "Día de Todos los Santos" },
  { month: 12, day: 8, name: "Inmaculada Concepción" },
  { month: 12, day: 9, name: "Batalla de Ayacucho" },
  { month: 12, day: 25, name: "Navidad" },
];

/**
 * Compute Easter Sunday date using the Anonymous Gregorian algorithm.
 */
function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export interface PeruHoliday {
  date: Date;
  name: string;
}

/**
 * Get all 16 Peru holidays for a given year.
 */
export function getPeruHolidays(year: number): PeruHoliday[] {
  const holidays: PeruHoliday[] = [];

  // Fixed holidays
  for (const h of FIXED_HOLIDAYS) {
    holidays.push({
      date: new Date(year, h.month - 1, h.day),
      name: h.name,
    });
  }

  // Easter-based movable holidays
  const easter = computeEasterSunday(year);
  const jueveSanto = new Date(easter);
  jueveSanto.setDate(easter.getDate() - 3);
  const viernesSanto = new Date(easter);
  viernesSanto.setDate(easter.getDate() - 2);

  holidays.push({ date: jueveSanto, name: "Jueves Santo" });
  holidays.push({ date: viernesSanto, name: "Viernes Santo" });

  // Sort by date
  holidays.sort((a, b) => a.date.getTime() - b.date.getTime());

  return holidays;
}

/**
 * Check if a given date is a Peru holiday.
 */
export function isPeruHoliday(date: Date, year?: number): { isHoliday: boolean; name?: string } {
  const y = year ?? date.getFullYear();
  const holidays = getPeruHolidays(y);
  const dateStr = formatDateKey(date);

  for (const h of holidays) {
    if (formatDateKey(h.date) === dateStr) {
      return { isHoliday: true, name: h.name };
    }
  }

  return { isHoliday: false };
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get days in a month (1-indexed month).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
