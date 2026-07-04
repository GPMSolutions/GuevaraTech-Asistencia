"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

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

  useEffect(() => {
    if (status !== "authenticated" || !session || session.user.role !== "ADMIN") return;

    const fetchKey = `${selectedYear}-${selectedMonth}`;
    if (currentFetch.current === fetchKey && hasFetched.current) return;
    currentFetch.current = fetchKey;
    hasFetched.current = true;

    setLoading(true);
    fetch(`/api/payroll?year=${selectedYear}&month=${selectedMonth}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PayrollData | null) => {
        setPayrollData(data);
        setLoading(false);
      });
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

  const totalPayroll = payrollData?.payroll.reduce((sum, p) => sum + p.totalPay, 0) ?? 0;

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
            {[2025, 2026, 2027].map((y) => (
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
            Total Planilla
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            S/ {totalPayroll.toFixed(2)}
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
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase text-xs">
                  Empleado
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Días Trab.
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Tarifa/Día
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Pago Regular
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Pago Dom.
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Bono Feriado
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase text-xs">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(!payrollData || payrollData.payroll.length === 0) ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No hay datos de planilla para este período
                  </td>
                </tr>
              ) : (
                payrollData.payroll.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {emp.employeeName}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {emp.totalDaysWorked}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      S/ {emp.dailyRate.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      S/ {emp.totalRegularPay.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      S/ {emp.totalSundayPay.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      S/ {emp.totalHolidayBonus.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      S/ {emp.totalPay.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
