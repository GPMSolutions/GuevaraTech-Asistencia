"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

interface Employee {
  id: string;
  name: string;
  email: string;
  monthlySalary: number;
  active: boolean;
  createdAt: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editSalary, setEditSalary] = useState<string | null>(null);
  const [salaryValue, setSalaryValue] = useState("");
  const [newEmployee, setNewEmployee] = useState({ name: "", monthlySalary: "1130" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const hasFetched = useRef(false);

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
      if (!hasFetched.current) {
        hasFetched.current = true;
        fetchEmployees();
      }
    }
  }, [status, session, router]);

  async function fetchEmployees() {
    const res = await fetch("/api/employees");
    if (res.ok) {
      const data = await res.json();
      setEmployees(data);
    }
    setLoading(false);
  }

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const salary = parseFloat(newEmployee.monthlySalary);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newEmployee.name,
        monthlySalary: isNaN(salary) ? undefined : salary,
      }),
    });

    if (res.ok) {
      setSuccess("Empleado agregado exitosamente");
      setNewEmployee({ name: "", monthlySalary: "1130" });
      setShowAddForm(false);
      await fetchEmployees();
    } else {
      const data = await res.json();
      setError(data.error || "Error al agregar empleado");
    }
  }

  async function handleDeleteEmployee(id: string, name: string) {
    if (!confirm(`¿Está seguro de eliminar a ${name}? Se borrarán todos sus registros.`)) {
      return;
    }
    setError("");
    setSuccess("");

    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSuccess("Empleado eliminado");
      await fetchEmployees();
    } else {
      const data = await res.json();
      setError(data.error || "Error al eliminar");
    }
  }

  async function handleUpdateSalary(id: string) {
    const salary = parseFloat(salaryValue);
    if (isNaN(salary) || salary < 0) {
      setError("Ingrese un salario válido");
      return;
    }
    setError("");
    setSuccess("");

    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlySalary: salary }),
    });

    if (res.ok) {
      setSuccess("Salario actualizado");
      setEditSalary(null);
      setSalaryValue("");
      await fetchEmployees();
    } else {
      const data = await res.json();
      setError(data.error || "Error al actualizar salario");
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !currentActive }),
    });
    if (res.ok) {
      await fetchEmployees();
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 text-lg">Cargando...</div>
      </div>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Gestión de Empleados
        </h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          {showAddForm ? "Cancelar" : "+ Agregar Empleado"}
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

      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Nuevo Empleado</h2>
          <form onSubmit={handleAddEmployee} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salario Mensual (S/)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newEmployee.monthlySalary}
                onChange={(e) => setNewEmployee({ ...newEmployee, monthlySalary: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Salario Mensual
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No hay empleados registrados
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className={!emp.active ? "opacity-50" : ""}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {emp.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    S/ {emp.monthlySalary.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleToggleActive(emp.id, emp.active)}
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        emp.active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {emp.active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditSalary(editSalary === emp.id ? null : emp.id);
                        setSalaryValue(emp.monthlySalary.toString());
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Editar Salario
                    </button>
                    <button
                      onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Eliminar
                    </button>
                    {editSalary === emp.id && (
                      <div className="mt-2 flex gap-2 justify-end">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Salario mensual"
                          value={salaryValue}
                          onChange={(e) => setSalaryValue(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 w-32"
                        />
                        <button
                          onClick={() => handleUpdateSalary(emp.id)}
                          className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Guardar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
