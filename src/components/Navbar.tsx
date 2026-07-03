"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  const isManager = session.user.role === "MANAGER";

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      pathname === path
        ? "bg-blue-700 text-white"
        : "text-blue-100 hover:bg-blue-600 hover:text-white"
    }`;

  return (
    <nav className="bg-blue-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg">TimeTracker</span>
            <div className="hidden sm:flex ml-6 gap-1">
              <Link href="/dashboard" className={linkClass("/dashboard")}>
                Dashboard
              </Link>
              {isManager && (
                <Link href="/manager" className={linkClass("/manager")}>
                  Reports
                </Link>
              )}
              <Link href="/profile" className={linkClass("/profile")}>
                Profile
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-blue-100 text-sm hidden sm:inline">
              {session.user.name}
              {isManager && (
                <span className="ml-1 text-xs bg-yellow-500 text-yellow-900 px-2 py-0.5 rounded-full">
                  Manager
                </span>
              )}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-md transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
        <div className="sm:hidden flex gap-1 pb-3">
          <Link href="/dashboard" className={linkClass("/dashboard")}>
            Dashboard
          </Link>
          {isManager && (
            <Link href="/manager" className={linkClass("/manager")}>
              Reports
            </Link>
          )}
          <Link href="/profile" className={linkClass("/profile")}>
            Profile
          </Link>
        </div>
      </div>
    </nav>
  );
}
