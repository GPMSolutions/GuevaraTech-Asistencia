"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { generatePayslipPdf } from "@/lib/payslip-pdf";
import { DEDUCTION_TYPE_OPTIONS, deductionTypeLabel } from "@/lib/deductions";

interface Deduction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  note: string | null;
  year: number;
  month: number;
}

interface PayrollEmployee {
  employeeId: string;
  employeeName: string;
  month: number;
  year: number;
  monthlySalary: number;
  daysInMonth: number;
  dailyRate: number;
  totalDaysWorked: number;
  totalRegularPay: number;
  totalSundayPay: number;
  totalHolidayBonus: number;
  totalPay: number;
  totalWorkedMinutes: number;
  bankMinutes: number;
  accumulatedBankMinutes: number;
  monthlyBankChange: number;
  deductions: Deduction[];
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

interface PayrollData {
  year: number;
  month: number;
  payroll: PayrollEmployee[];
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function PlanillaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [payrollData, setPayrollData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);
  const [managing, setManaging] = useState<PayrollEmployee | null>(null);
  const hasFetched = useRef(false);
  const currentFetch = useRef("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && session.user.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  function reload() {
    setLoading(true);
    fetch(`/api/payroll?year=${selectedYear}&month=${selectedMonth}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PayrollData | null) => {
        setPayrollData(data);
        setLoading(false);
        if (managing && data) {
          const updated = data.payroll.find(
            (p) => p.employeeId === managing.employeeId
          );
          if (updated) setManaging(updated);
        }
      });
  }

  useEffect(() => {
    if (status !== "authenticated" || !session || session.user.role !== "ADMIN") return;

    const fetchKey = `${selectedYear}-${selectedMonth}`;
    if (currentFetch.current === fetchKey && hasFetched.current) return;
    currentFetch.current = fetchKey;
    hasFetched.current = true;

    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, selectedYear, selectedMonth]);

  async function handleExport() {
    setExporting(true);
    const res = await fetch(
      `/api/payroll/export?year=${selectedYear}&month=${selectedMonth}`
    );
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `planilla_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 text-lg">Cargando...</div>
      </div>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  const totalNet = payrollData?.payroll.reduce((sum, p) => sum + p.netPay, 0) ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Planilla</h1>
        <div className="flex gap-3 items-center">
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(parseInt(e.target.value));
              hasFetched.current = false;
            }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(parseInt(e.target.value));
              hasFetched.current = false;
            }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {[2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {exporting ? "Exportando..." : "Exportar CSV"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-5 text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            Total a Pagar
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            S/ {totalNet.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-5 text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            Empleados
          </p>
          <p className="text-2xl font-bold text-gray-800 mt-1">
            {payrollData?.payroll.length ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-5 text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            Período
          </p>
          <p className="text-lg font-semibold text-gray-800 mt-2">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </p>
        </div>
      </div>

      {/* Payroll table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase text-xs">
                  Empleado
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Días
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Regular
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Dom.
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Feriado
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Banco Horas
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Descuentos
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Total a Pagar
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(!payrollData || payrollData.payroll.length === 0) ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No hay datos de planilla para este período
                  </td>
                </tr>
              ) : (
                payrollData.payroll.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-900">
                      {emp.employeeName}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      {emp.totalDaysWorked}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      S/ {emp.totalRegularPay.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      S/ {emp.totalSundayPay.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      S/ {emp.totalHolidayBonus.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-medium text-blue-700">
                        {formatHoursMinutes(emp.accumulatedBankMinutes)}
                      </span>
                      {emp.monthlyBankChange !== 0 && (
                        <span className="block text-[11px] text-gray-400">
                          {emp.monthlyBankChange > 0 ? "+" : "−"}
                          {formatHoursMinutes(Math.abs(emp.monthlyBankChange))} este mes
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-red-600">
                      {emp.totalDeductions > 0
                        ? `- S/ ${emp.totalDeductions.toFixed(2)}`
                        : "S/ 0.00"}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-700">
                      S/ {emp.netPay.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => setManaging(emp)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Descuentos
                      </button>
                      <button
                        onClick={() =>
                          generatePayslipPdf(emp, selectedMonth, selectedYear)
                        }
                        className="text-emerald-700 hover:text-emerald-900 text-xs font-medium"
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {managing && (
        <DeductionsModal
          employee={managing}
          month={selectedMonth}
          year={selectedYear}
          onClose={() => setManaging(null)}
          onChange={reload}
        />
      )}
    </div>
  );
}

function DeductionsModal({
  employee,
  month,
  year,
  onClose,
  onChange,
}: {
  employee: PayrollEmployee;
  month: number;
  year: number;
  onClose: () => void;
  onChange: () => void;
}) {
  const [type, setType] = useState(DEDUCTION_TYPE_OPTIONS[0].value);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Ingrese un monto válido mayor a 0");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/deductions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: employee.employeeId,
        type,
        amount: parsed,
        note,
        year,
        month,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setAmount("");
      setNote("");
      onChange();
    } else {
      const data = await res.json();
      setError(data.error || "Error al guardar");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este descuento?")) return;
    const res = await fetch(`/api/deductions?id=${id}`, { method: "DELETE" });
    if (res.ok) onChange();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Descuentos — {employee.employeeName}
            </h2>
            <p className="text-sm text-gray-500">
              {MONTH_NAMES[month - 1]} {year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleAdd} className="space-y-3 mb-5">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {DEDUCTION_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Monto (S/)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nota (opcional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. detalle del producto"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Guardando..." : "+ Agregar Descuento"}
          </button>
        </form>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Descuentos registrados
          </h3>
          {employee.deductions.length === 0 ? (
            <p className="text-gray-500 text-sm py-2">
              No hay descuentos para este mes
            </p>
          ) : (
            <div className="space-y-2">
              {employee.deductions.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <span className="text-gray-800 font-medium text-sm">
                      {deductionTypeLabel(d.type)}
                    </span>
                    {d.note && (
                      <span className="text-gray-500 text-xs ml-2">
                        {d.note}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-red-600 text-sm font-medium">
                      - S/ {d.amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 font-semibold text-sm">
                <span>Total Descuentos</span>
                <span className="text-red-600">
                  - S/ {employee.totalDeductions.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between font-bold text-sm text-emerald-700">
                <span>Total a Pagar</span>
                <span>S/ {employee.netPay.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
