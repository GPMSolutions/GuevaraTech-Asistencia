"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Employee {
  id: string;
  name: string;
  monthlySalary: number;
}

interface DaySummary {
  date: string;
  workMinutes: number;
  lunchMinutes: number;
  entries: { type: string; timestamp: string }[];
}

interface EmployeeReport {
  employee: Employee;
  dailySummaries: DaySummary[];
  totalWorkMinutes: number;
  totalWorkHours: number;
}

interface ReportGroup {
  label: string;
  startDate: string;
  endDate: string;
  report: EmployeeReport[];
}

interface ReportData {
  period: "week" | "month";
  year: number;
  month: number;
  groups: ReportGroup[];
}

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const YEARS = [2026, 2027, 2028];

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  e.setDate(e.getDate() - 1); // end is exclusive
  return `${format(s, "d MMM", { locale: es })} – ${format(e, "d MMM", {
    locale: es,
  })}`;
}

export default function ReportesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const now = new Date();
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const hasFetchedEmployees = useRef(false);
  const currentFetch = useRef<string>("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      if (session.user.role !== "ADMIN") {
        router.push("/dashboard");
        return;
      }
      if (!hasFetchedEmployees.current) {
        hasFetchedEmployees.current = true;
        fetch("/api/employees")
          .then((res) => (res.ok ? res.json() : []))
          .then((data: Employee[]) => setEmployees(data));
      }
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated" || !session || session.user.role !== "ADMIN")
      return;

    const fetchKey = `${period}-${year}-${month}-${selectedEmployee}`;
    if (currentFetch.current === fetchKey) return;
    currentFetch.current = fetchKey;

    setLoading(true);
    const params = new URLSearchParams({
      period,
      year: String(year),
      month: String(month),
    });
    if (selectedEmployee) params.set("userId", selectedEmployee);

    fetch(`/api/reports?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReportData | null) => {
        setReportData(data);
        setLoading(false);
      });
  }, [status, session, period, year, month, selectedEmployee]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 text-lg">Cargando...</div>
      </div>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  const hasData =
    reportData &&
    reportData.groups.some((g) => g.report.some((r) => r.dailySummaries.length > 0));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Reportes de Asistencia
        </h1>
        <div className="flex flex-wrap gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todos los Empleados</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            <button
              onClick={() => setPeriod("week")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === "week"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Semanal
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === "month"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Mensual
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-gray-500 text-lg">Cargando reporte...</div>
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">
            No hay datos para {MONTHS[month - 1]} {year}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {reportData!.groups.map((group) => {
            const groupHasData = group.report.some(
              (r) => r.dailySummaries.length > 0
            );
            if (!groupHasData) return null;
            const groupTotalMinutes = group.report.reduce(
              (sum, r) => sum + r.totalWorkMinutes,
              0
            );

            return (
              <div key={group.startDate}>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {period === "month"
                      ? `${MONTHS[month - 1]} ${year}`
                      : group.label}
                    <span className="ml-2 text-sm font-normal text-gray-400">
                      {formatRange(group.startDate, group.endDate)}
                    </span>
                  </h2>
                  <span className="text-sm text-gray-500">
                    Total: {formatMinutes(groupTotalMinutes)}
                  </span>
                </div>

                <div className="space-y-4">
                  {group.report
                    .filter((r) => r.dailySummaries.length > 0)
                    .map((empReport) => {
                      const key = `${group.startDate}-${empReport.employee.id}`;
                      return (
                        <div
                          key={key}
                          className="bg-white rounded-lg shadow-md overflow-hidden"
                        >
                          <button
                            onClick={() =>
                              setExpandedKey(expandedKey === key ? null : key)
                            }
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                                {empReport.employee.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="text-left">
                                <p className="font-semibold text-gray-900">
                                  {empReport.employee.name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {empReport.dailySummaries.length} días
                                  trabajados
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-emerald-600">
                                {formatMinutes(empReport.totalWorkMinutes)}
                              </p>
                            </div>
                          </button>

                          {expandedKey === key && (
                            <div className="border-t border-gray-100 px-6 py-4">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-500 border-b">
                                    <th className="text-left py-2 font-medium">
                                      Fecha
                                    </th>
                                    <th className="text-right py-2 font-medium">
                                      Trabajo
                                    </th>
                                    <th className="text-right py-2 font-medium">
                                      Almuerzo
                                    </th>
                                    <th className="text-right py-2 font-medium">
                                      Registros
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {empReport.dailySummaries.map((day) => (
                                    <tr
                                      key={day.date}
                                      className="border-b border-gray-50"
                                    >
                                      <td className="py-2 text-gray-800">
                                        {format(
                                          new Date(day.date + "T12:00:00"),
                                          "EEE, d MMM",
                                          { locale: es }
                                        )}
                                      </td>
                                      <td className="py-2 text-right text-gray-800">
                                        {formatMinutes(day.workMinutes)}
                                      </td>
                                      <td className="py-2 text-right text-gray-500">
                                        {formatMinutes(day.lunchMinutes)}
                                      </td>
                                      <td className="py-2 text-right text-gray-500">
                                        {day.entries.length}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
