"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  const isAdmin = session.user.role === "ADMIN";
  const isKiosk = session.user.role === "KIOSK";

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      pathname === path
        ? "bg-emerald-700 text-white"
        : "text-emerald-100 hover:bg-emerald-600 hover:text-white"
    }`;

  return (
    <nav className="bg-emerald-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Guevara Technology" className="h-10 w-auto" />
            <span className="text-white font-bold text-lg hidden lg:inline">GuevaraTech</span>
            <div className="hidden sm:flex ml-6 gap-1">
              {isKiosk && (
                <Link href="/kiosk" className={linkClass("/kiosk")}>
                  Marcar Asistencia
                </Link>
              )}
              {!isAdmin && !isKiosk && (
                <Link href="/dashboard" className={linkClass("/dashboard")}>
                  Mi Asistencia
                </Link>
              )}
              {isAdmin && (
                <>
                  <Link href="/admin" className={linkClass("/admin")}>
                    Empleados
                  </Link>
                  <Link href="/admin/asistencia" className={linkClass("/admin/asistencia")}>
                    Asistencia
                  </Link>
                  <Link href="/admin/reportes" className={linkClass("/admin/reportes")}>
                    Reportes
                  </Link>
                  <Link href="/admin/planilla" className={linkClass("/admin/planilla")}>
                    Planilla
                  </Link>
                  <Link href="/admin/cuenta" className={linkClass("/admin/cuenta")}>
                    Mi Cuenta
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-100 text-sm hidden sm:inline">
              {session.user.name}
              {isAdmin && (
                <span className="ml-1 text-xs bg-yellow-500 text-yellow-900 px-2 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-md transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
        <div className="sm:hidden flex gap-1 pb-3">
          {!isAdmin && (
            <Link href="/dashboard" className={linkClass("/dashboard")}>
              Mi Asistencia
            </Link>
          )}
          {isAdmin && (
            <>
              <Link href="/admin" className={linkClass("/admin")}>
                Empleados
              </Link>
              <Link href="/admin/asistencia" className={linkClass("/admin/asistencia")}>
                Asistencia
              </Link>
              <Link href="/admin/reportes" className={linkClass("/admin/reportes")}>
                Reportes
              </Link>
              <Link href="/admin/planilla" className={linkClass("/admin/planilla")}>
                Planilla
              </Link>
              <Link href="/admin/cuenta" className={linkClass("/admin/cuenta")}>
                Mi Cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
