"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
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

interface ReportData {
  period: string;
  startDate: string;
  report: EmployeeReport[];
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function ManagerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const hasFetchedEmployees = useRef(false);
  const currentFetch = useRef<string>("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      if (session.user.role !== "MANAGER") {
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
    if (status !== "authenticated" || !session || session.user.role !== "MANAGER")
      return;

    const fetchKey = `${period}-${selectedEmployee}`;
    if (currentFetch.current === fetchKey) return;
    currentFetch.current = fetchKey;

    setLoading(true);
    const params = new URLSearchParams({ period });
    if (selectedEmployee) params.set("userId", selectedEmployee);

    fetch(`/api/reports?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReportData | null) => {
        setReportData(data);
        setLoading(false);
      });
  }, [status, session, period, selectedEmployee]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 text-lg">Loading...</div>
      </div>
    );
  }

  if (!session || session.user.role !== "MANAGER") return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Employee Hours Report
        </h1>
        <div className="flex gap-3">
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Employees</option>
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
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === "month"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-gray-500 text-lg">Loading report...</div>
        </div>
      ) : (
        <>
          {reportData && reportData.report.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-md p-5 text-center">
                <p className="text-sm text-gray-500 uppercase tracking-wide">
                  Total Employees
                </p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {reportData.report.length}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-5 text-center">
                <p className="text-sm text-gray-500 uppercase tracking-wide">
                  Avg Hours
                </p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {(
                    reportData.report.reduce(
                      (sum, r) => sum + r.totalWorkHours,
                      0
                    ) / reportData.report.length
                  ).toFixed(1)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-5 text-center">
                <p className="text-sm text-gray-500 uppercase tracking-wide">
                  Period
                </p>
                <p className="text-lg font-semibold text-gray-800 mt-2">
                  {period === "week" ? "This Week" : "This Month"}
                </p>
                <p className="text-sm text-gray-400">
                  From {format(new Date(reportData.startDate), "MMM d")}
                </p>
              </div>
            </div>
          )}

          {!reportData || reportData.report.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-500">
                No data available for this period
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reportData.report.map((empReport) => (
                <div
                  key={empReport.employee.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedEmployee(
                        expandedEmployee === empReport.employee.id
                          ? null
                          : empReport.employee.id
                      )
                    }
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                        {empReport.employee.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">
                          {empReport.employee.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {empReport.employee.email}
                          {empReport.employee.department && (
                            <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {empReport.employee.department}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">
                        {empReport.totalWorkHours}h
                      </p>
                      <p className="text-xs text-gray-400">
                        {empReport.dailySummaries.length} days worked
                      </p>
                    </div>
                  </button>

                  {expandedEmployee === empReport.employee.id && (
                    <div className="border-t border-gray-100 px-6 py-4">
                      {empReport.dailySummaries.length === 0 ? (
                        <p className="text-gray-500 text-sm">No entries</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500 border-b">
                              <th className="text-left py-2 font-medium">
                                Date
                              </th>
                              <th className="text-right py-2 font-medium">
                                Work Time
                              </th>
                              <th className="text-right py-2 font-medium">
                                Lunch
                              </th>
                              <th className="text-right py-2 font-medium">
                                Entries
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
                                    "EEE, MMM d"
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
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
