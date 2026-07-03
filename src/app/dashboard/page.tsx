"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

function getAvailableActions(lastType: string | undefined): string[] {
  if (!lastType || lastType === "CLOCK_OUT") return ["CLOCK_IN"];
  if (lastType === "CLOCK_IN") return ["LUNCH_OUT", "CLOCK_OUT"];
  if (lastType === "LUNCH_OUT") return ["LUNCH_IN"];
  if (lastType === "LUNCH_IN") return ["LUNCH_OUT", "CLOCK_OUT"];
  return ["CLOCK_IN"];
}

function getStatusMessage(lastType: string | undefined): string {
  if (!lastType || lastType === "CLOCK_OUT") return "No registrado";
  if (lastType === "CLOCK_IN" || lastType === "LUNCH_IN") return "Trabajando";
  if (lastType === "LUNCH_OUT") return "En Almuerzo";
  return "Desconocido";
}

function getStatusColor(lastType: string | undefined): string {
  if (!lastType || lastType === "CLOCK_OUT") return "text-gray-500";
  if (lastType === "CLOCK_IN" || lastType === "LUNCH_IN")
    return "text-green-600";
  if (lastType === "LUNCH_OUT") return "text-yellow-600";
  return "text-gray-500";
}

async function fetchTodayEntries(): Promise<TimeEntry[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const res = await fetch(
    `/api/time-entries?startDate=${todayStart.toISOString()}`
  );
  if (res.ok) return res.json();
  return [];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const hasFetched = useRef(false);

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
      if (!hasFetched.current) {
        hasFetched.current = true;
        fetchTodayEntries().then((data) => {
          setEntries(data);
          setLoading(false);
        });
      }
    }
  }, [status, session, router]);

  async function refreshEntries() {
    const data = await fetchTodayEntries();
    setEntries(data);
  }

  async function handleAction(type: string) {
    setActionLoading(true);
    setError("");
    const res = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al registrar");
    } else {
      await refreshEntries();
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

  if (!session) return null;

  const lastEntry = entries[0];
  const availableActions = getAvailableActions(lastEntry?.type);
  const statusMessage = getStatusMessage(lastEntry?.type);
  const statusColor = getStatusColor(lastEntry?.type);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {session.user.name}
        </h1>
        <p className="text-gray-500 mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM, yyyy", { locale: es })}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            Estado Actual
          </p>
          <p className={`text-2xl font-bold mt-1 ${statusColor}`}>
            {statusMessage}
          </p>
          {lastEntry && (
            <p className="text-sm text-gray-400 mt-1">
              Última acción: {ACTION_CONFIG[lastEntry.type]?.label} a las{" "}
              {format(new Date(lastEntry.timestamp), "h:mm a")}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Actividad de Hoy
        </h2>
        {entries.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No hay actividad registrada hoy
          </p>
        ) : (
          <div className="space-y-3">
            {[...entries].reverse().map((entry) => {
              const config = ACTION_CONFIG[entry.type];
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block w-3 h-3 rounded-full ${config?.color || "bg-gray-400"}`}
                    />
                    <span className="text-gray-800 font-medium">
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
  );
}
