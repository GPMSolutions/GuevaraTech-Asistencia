"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface KioskEmployee {
  id: string;
  name: string;
  lastType: string | null;
}

interface TimeEntry {
  id: string;
  type: string;
  timestamp: string;
}

const ACTION_CONFIG: Record<
  string,
  { label: string; color: string; hoverColor: string; icon: string }
> = {
  CLOCK_IN: {
    label: "Entrada",
    color: "bg-green-600",
    hoverColor: "hover:bg-green-700",
    icon: "-->",
  },
  LUNCH_OUT: {
    label: "Salida Almuerzo",
    color: "bg-yellow-500",
    hoverColor: "hover:bg-yellow-600",
    icon: "...",
  },
  LUNCH_IN: {
    label: "Regreso Almuerzo",
    color: "bg-orange-500",
    hoverColor: "hover:bg-orange-600",
    icon: "<--",
  },
  CLOCK_OUT: {
    label: "Salida",
    color: "bg-red-600",
    hoverColor: "hover:bg-red-700",
    icon: "[x]",
  },
};

function getAvailableActions(lastType: string | null | undefined): string[] {
  if (!lastType || lastType === "CLOCK_OUT") return ["CLOCK_IN"];
  if (lastType === "CLOCK_IN") return ["LUNCH_OUT", "CLOCK_OUT"];
  if (lastType === "LUNCH_OUT") return ["LUNCH_IN"];
  if (lastType === "LUNCH_IN") return ["LUNCH_OUT", "CLOCK_OUT"];
  return ["CLOCK_IN"];
}

function getStatusMessage(lastType: string | null | undefined): string {
  if (!lastType || lastType === "CLOCK_OUT") return "No registrado";
  if (lastType === "CLOCK_IN" || lastType === "LUNCH_IN") return "Trabajando";
  if (lastType === "LUNCH_OUT") return "En Almuerzo";
  return "Desconocido";
}

function getStatusColor(lastType: string | null | undefined): string {
  if (!lastType || lastType === "CLOCK_OUT") return "text-gray-500";
  if (lastType === "CLOCK_IN" || lastType === "LUNCH_IN")
    return "text-green-600";
  if (lastType === "LUNCH_OUT") return "text-yellow-600";
  return "text-gray-500";
}

export default function KioskPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [employees, setEmployees] = useState<KioskEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<KioskEmployee | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const hasFetched = useRef(false);

  const loadEmployees = useCallback(async () => {
    const res = await fetch("/api/kiosk/employees");
    if (res.ok) {
      setEmployees(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      if (session.user.role === "ADMIN") {
        router.push("/admin");
        return;
      }
      if (session.user.role === "EMPLOYEE") {
        router.push("/dashboard");
        return;
      }
      if (!hasFetched.current) {
        hasFetched.current = true;
        loadEmployees();
      }
    }
  }, [status, session, router, loadEmployees]);

  async function openEmployee(emp: KioskEmployee) {
    setSelected(emp);
    setError("");
    setEntries([]);
    const res = await fetch(`/api/kiosk/time-entries?userId=${emp.id}`);
    if (res.ok) setEntries(await res.json());
  }

  function closePanel() {
    setSelected(null);
    setEntries([]);
    setError("");
  }

  async function handleAction(type: string) {
    if (!selected) return;
    setActionLoading(true);
    setError("");
    const res = await fetch("/api/kiosk/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selected.id, type }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al registrar");
    } else {
      const entriesRes = await fetch(
        `/api/kiosk/time-entries?userId=${selected.id}`
      );
      if (entriesRes.ok) setEntries(await entriesRes.json());
      await loadEmployees();
    }
    setActionLoading(false);
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 text-lg">Cargando...</div>
      </div>
    );
  }

  if (!session || session.user.role !== "KIOSK") return null;

  const lastEntry = entries[0];
  const availableActions = getAvailableActions(
    lastEntry?.type ?? selected?.lastType
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Marcar Asistencia</h1>
        <p className="text-gray-500 mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM, yyyy", { locale: es })} —
          selecciona tu nombre para registrar.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {employees.map((emp) => {
          const statusMsg = getStatusMessage(emp.lastType);
          const statusColor = getStatusColor(emp.lastType);
          return (
            <button
              key={emp.id}
              onClick={() => openEmployee(emp)}
              className="bg-white rounded-lg shadow-md p-4 text-left hover:shadow-lg hover:ring-2 hover:ring-emerald-400 transition-all"
            >
              <p className="font-semibold text-gray-900 leading-tight">
                {emp.name}
              </p>
              <p className={`text-sm mt-1 font-medium ${statusColor}`}>
                {statusMsg}
              </p>
            </button>
          );
        })}
        {employees.length === 0 && (
          <p className="text-gray-500 col-span-full text-center py-8">
            No hay empleados activos
          </p>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={closePanel}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selected.name}
                </h2>
                <p
                  className={`text-sm font-medium ${getStatusColor(
                    lastEntry?.type ?? selected.lastType
                  )}`}
                >
                  {getStatusMessage(lastEntry?.type ?? selected.lastType)}
                  {lastEntry && (
                    <span className="text-gray-400 font-normal">
                      {" "}
                      · {ACTION_CONFIG[lastEntry.type]?.label} a las{" "}
                      {format(new Date(lastEntry.timestamp), "h:mm a")}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={closePanel}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {availableActions.map((action) => {
                const config = ACTION_CONFIG[action];
                return (
                  <button
                    key={action}
                    onClick={() => handleAction(action)}
                    disabled={actionLoading}
                    className={`${config.color} ${config.hoverColor} text-white font-medium py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg`}
                  >
                    <span className="mr-2 font-mono">{config.icon}</span>
                    {config.label}
                  </button>
                );
              })}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Actividad de Hoy
              </h3>
              {entries.length === 0 ? (
                <p className="text-gray-500 text-sm py-2">
                  No hay actividad registrada hoy
                </p>
              ) : (
                <div className="space-y-2">
                  {[...entries].reverse().map((entry) => {
                    const config = ACTION_CONFIG[entry.type];
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block w-2.5 h-2.5 rounded-full ${
                              config?.color || "bg-gray-400"
                            }`}
                          />
                          <span className="text-gray-800 text-sm font-medium">
                            {config?.label || entry.type}
                          </span>
                        </div>
                        <span className="text-gray-500 text-sm">
                          {format(new Date(entry.timestamp), "h:mm:ss a")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
