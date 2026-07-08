import { jsPDF } from "jspdf";
import { deductionTypeLabel } from "./deductions";

export interface PayslipDeduction {
  id: string;
  type: string;
  amount: number;
  note: string | null;
}

export interface PayslipEmployee {
  employeeName: string;
  monthlySalary: number;
  daysInMonth: number;
  dailyRate: number;
  totalDaysWorked: number;
  totalRegularPay: number;
  totalSundayPay: number;
  totalHolidayBonus: number;
  totalPay: number;
  totalWorkedMinutes: number;
  bankMinutes?: number;
  accumulatedBankMinutes?: number;
  deductions: PayslipDeduction[];
  totalDeductions: number;
  netPay: number;
}

function formatHoursMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0 && m === 0) return "0h";
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function money(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}

export function generatePayslipPdf(
  emp: PayslipEmployee,
  month: number,
  year: number
): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 48;
  const right = pageWidth - 48;
  let y = 56;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Guevara Technology", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Boleta de Pago", left, y + 18);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${MONTH_NAMES[month - 1]} ${year}`, right, y, { align: "right" });
  y += 44;

  doc.setDrawColor(200);
  doc.line(left, y, right, y);
  y += 24;

  // Employee info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(emp.employeeName, left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Salario mensual: ${money(emp.monthlySalary)}   ·   Tarifa/día: ${money(
      emp.dailyRate
    )}`,
    left,
    y + 16
  );
  doc.text(
    `Días trabajados: ${emp.totalDaysWorked}   ·   Horas trabajadas: ${formatHoursMinutes(
      emp.totalWorkedMinutes
    )}`,
    left,
    y + 32
  );
  if (emp.accumulatedBankMinutes && emp.accumulatedBankMinutes > 0) {
    doc.text(
      `Horas a favor (banco): ${formatHoursMinutes(
        emp.accumulatedBankMinutes
      )} (no se paga)`,
      left,
      y + 48
    );
    y += 16;
  }
  y += 60;

  // Earnings section
  y = section(doc, "Ingresos", left, right, y);
  y = row(doc, "Pago Regular", money(emp.totalRegularPay), left, right, y);
  y = row(doc, "Pago Dominical", money(emp.totalSundayPay), left, right, y);
  y = row(doc, "Bono Feriado", money(emp.totalHolidayBonus), left, right, y);
  y = totalRow(doc, "Total Bruto", money(emp.totalPay), left, right, y);
  y += 16;

  // Deductions section
  y = section(doc, "Descuentos", left, right, y);
  if (emp.deductions.length === 0) {
    y = row(doc, "Sin descuentos", money(0), left, right, y);
  } else {
    for (const d of emp.deductions) {
      const label = d.note
        ? `${deductionTypeLabel(d.type)} (${d.note})`
        : deductionTypeLabel(d.type);
      y = row(doc, label, `- ${money(d.amount)}`, left, right, y);
    }
  }
  y = totalRow(doc, "Total Descuentos", `- ${money(emp.totalDeductions)}`, left, right, y);
  y += 16;

  // Net pay
  doc.setFillColor(16, 122, 87);
  doc.rect(left, y, right - left, 30, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TOTAL A PAGAR", left + 12, y + 20);
  doc.text(money(emp.netPay), right - 12, y + 20, { align: "right" });
  doc.setTextColor(0);
  y += 80;

  // Signature line
  const sigWidth = 220;
  const sigX = left;
  doc.setDrawColor(120);
  doc.line(sigX, y, sigX + sigWidth, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Firma del trabajador", sigX, y + 16);
  doc.text(emp.employeeName, sigX, y + 30);

  const dateX = right - sigWidth;
  doc.line(dateX, y, dateX + sigWidth, y);
  doc.text("Fecha", dateX, y + 16);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    "Recibí conforme el pago correspondiente al período indicado.",
    left,
    y + 60
  );

  const monthLabel = MONTH_NAMES[month - 1];
  const safeName = emp.employeeName.replace(/[^a-zA-Z0-9]+/g, "_");
  doc.save(`boleta_${safeName}_${monthLabel}_${year}.pdf`);
}

function section(
  doc: jsPDF,
  title: string,
  left: number,
  right: number,
  y: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(16, 122, 87);
  doc.text(title, left, y);
  doc.setTextColor(0);
  doc.setDrawColor(220);
  doc.line(left, y + 6, right, y + 6);
  return y + 24;
}

function row(
  doc: jsPDF,
  label: string,
  value: string,
  left: number,
  right: number,
  y: number
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(label, left, y);
  doc.text(value, right, y, { align: "right" });
  return y + 18;
}

function totalRow(
  doc: jsPDF,
  label: string,
  value: string,
  left: number,
  right: number,
  y: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(label, left, y);
  doc.text(value, right, y, { align: "right" });
  return y + 20;
}
