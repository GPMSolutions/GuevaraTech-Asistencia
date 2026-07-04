"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface TimeEntry {
  id: string;
  userId: string;
  type: string;
  timestamp: string;
}

const TYPE_LABELS: Record<string, string> = {
  CLOCK_IN: "Entrada",
  LUNCH_OUT: "Salida Almuerzo",
  LUNCH_IN: "Regreso Almuerzo",
  CLOCK_OUT: "Salida",
};

const TYPE_COLORS: Record<string, string> = {
  CLOCK_IN: "bg-green-100 text-green-800",
  LUNCH_OUT: "bg-yellow-100 text-yellow-800",
  LUNCH_IN: "bg-orange-100 text-orange-800",
  CLOCK_OUT: "bg-red-100 text-red-800",
};

export default function AsistenciaAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editType, setEditType] = useState("");
  const [editTime, setEditTime] = useState("");
  const [newType, setNewType] = useState("CLOCK_IN");
  const [newTime, setNewTime] = useState("08:00");
  const hasFetchedEmployees = useRef(false);

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
          .then((data: Employee[]) => {
            setEmployees(data);
            if (data.length > 0) setSelectedEmployee(data[0].id);
          });
      }
    }
  }, [status, session, router]);

  useEffect(() => {
    if (selectedEmployee && selectedDate) {
      fetchEntries();
    }
  }, [selectedEmployee, selectedDate]);

  async function fetchEntries() {
    if (!selectedEmployee) return;
    setLoading(true);
    const startDate = new Date(selectedDate + "T00:00:00");
    const endDate = new Date(selectedDate + "T23:59:59");

    const params = new URLSearchParams({
      userId: selectedEmployee,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const res = await fetch(`/api/time-entries?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data);
    }
    setLoading(false);
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const timestamp = new Date(`${selectedDate}T${newTime}:00`);

    const res = await fetch("/api/time-entries/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedEmployee,
        type: newType,
        timestamp: timestamp.toISOString(),
      }),
    });

    if (res.ok) {
      setSuccess("Registro agregado");
      setShowAddForm(false);
      await fetchEntries();
    } else {
      const data = await res.json();
      setError(data.error || "Error al agregar registro");
    }
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    setError("");
    setSuccess("");

    const res = await fetch(`/api/time-entries/admin?id=${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setSuccess("Registro eliminado");
      await fetchEntries();
    } else {
      const data = await res.json();
      setError(data.error || "Error al eliminar");
    }
  }

  async function handleEditEntry(id: string) {
    setError("");
    setSuccess("");

    const timestamp = new Date(`${selectedDate}T${editTime}:00`);

    const res = await fetch("/api/time-entries/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        type: editType,
        timestamp: timestamp.toISOString(),
      }),
    });

    if (res.ok) {
      setSuccess("Registro actualizado");
      setEditingEntry(null);
      await fetchEntries();
    } else {
      const data = await res.json();
      setError(data.error || "Error al actualizar");
    }
  }

  function startEdit(entry: TimeEntry) {
    setEditingEntry(entry.id);
    setEditType(entry.type);
    setEditTime(format(new Date(entry.timestamp), "HH:mm"));
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 text-lg">Cargando...</div>
      </div>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Gestión de Asistencia
        </h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          {showAddForm ? "Cancelar" : "+ Agregar Registro"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm mb-4">
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Empleado
          </label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Add entry form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Agregar Registro Manual</h2>
          <form onSubmit={handleAddEntry} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="CLOCK_IN">Entrada</option>
                <option value="LUNCH_OUT">Salida Almuerzo</option>
                <option value="LUNCH_IN">Regreso Almuerzo</option>
                <option value="CLOCK_OUT">Salida</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora
              </label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Guardar
            </button>
          </form>
        </div>
      )}

      {/* Entries list */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Registros del{" "}
            {format(new Date(selectedDate + "T12:00:00"), "EEEE d 'de' MMMM, yyyy", {
              locale: es,
            })}
          </h2>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500">Cargando...</div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No hay registros para este día
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tipo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...entries].reverse().map((entry) => (
                <tr key={entry.id}>
                  {editingEntry === entry.id ? (
                    <>
                      <td className="px-6 py-3">
                        <input
                          type="time"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                        >
                          <option value="CLOCK_IN">Entrada</option>
                          <option value="LUNCH_OUT">Salida Almuerzo</option>
                          <option value="LUNCH_IN">Regreso Almuerzo</option>
                          <option value="CLOCK_OUT">Salida</option>
                        </select>
                      </td>
                      <td className="px-6 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleEditEntry(entry.id)}
                          className="text-green-600 hover:text-green-800 text-xs font-medium"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingEntry(null)}
                          className="text-gray-600 hover:text-gray-800 text-xs font-medium"
                        >
                          Cancelar
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-3 text-sm text-gray-900">
                        {format(new Date(entry.timestamp), "h:mm a")}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${TYPE_COLORS[entry.type] || "bg-gray-100 text-gray-800"}`}
                        >
                          {TYPE_LABELS[entry.type] || entry.type}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right space-x-2">
                        <button
                          onClick={() => startEdit(entry)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Eliminar
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
