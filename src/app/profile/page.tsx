"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { format, startOfWeek, startOfMonth } from "date-fns";

interface TimeEntry {
  id: string;
  type: string;
  timestamp: string;
}

interface HoursSummary {
  weekly: number;
  monthly: number;
}

function computeWorkHours(entries: TimeEntry[]): number {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let totalMinutes = 0;
  let clockInTime: Date | null = null;

  for (const entry of sorted) {
    const ts = new Date(entry.timestamp);
    switch (entry.type) {
      case "CLOCK_IN":
        clockInTime = ts;
        break;
      case "LUNCH_OUT":
        if (clockInTime) {
          totalMinutes += (ts.getTime() - clockInTime.getTime()) / 60000;
          clockInTime = null;
        }
        break;
      case "LUNCH_IN":
        clockInTime = ts;
        break;
      case "CLOCK_OUT":
        if (clockInTime) {
          totalMinutes += (ts.getTime() - clockInTime.getTime()) / 60000;
          clockInTime = null;
        }
        break;
    }
  }

  return Math.round((totalMinutes / 60) * 100) / 100;
}

async function fetchProfileData(): Promise<{
  summary: HoursSummary;
  recentEntries: TimeEntry[];
}> {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const [weekRes, monthRes] = await Promise.all([
    fetch(`/api/time-entries?startDate=${weekStart.toISOString()}`),
    fetch(`/api/time-entries?startDate=${monthStart.toISOString()}`),
  ]);

  if (weekRes.ok && monthRes.ok) {
    const weekEntries: TimeEntry[] = await weekRes.json();
    const monthEntries: TimeEntry[] = await monthRes.json();

    return {
      summary: {
        weekly: computeWorkHours(weekEntries),
        monthly: computeWorkHours(monthEntries),
      },
      recentEntries: monthEntries.slice(0, 20),
    };
  }
  return { summary: { weekly: 0, monthly: 0 }, recentEntries: [] };
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [summary, setSummary] = useState<HoursSummary>({
    weekly: 0,
    monthly: 0,
  });
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && !hasFetched.current) {
      hasFetched.current = true;
      fetchProfileData().then((data) => {
        setSummary(data.summary);
        setRecentEntries(data.recentEntries);
        setLoading(false);
      });
    }
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 text-lg">Loading...</div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {session.user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {session.user.name}
            </h2>
            <p className="text-gray-500">{session.user.email}</p>
            <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              {session.user.role}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            This Week
          </p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {summary.weekly}
          </p>
          <p className="text-gray-500 text-sm">hours</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            This Month
          </p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {summary.monthly}
          </p>
          <p className="text-gray-500 text-sm">hours</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Activity
        </h2>
        {recentEntries.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-gray-800 font-medium text-sm">
                  {formatEntryType(entry.type)}
                </span>
                <span className="text-gray-500 text-sm">
                  {format(new Date(entry.timestamp), "MMM d, h:mm a")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatEntryType(type: string): string {
  switch (type) {
    case "CLOCK_IN":
      return "Clock In";
    case "LUNCH_OUT":
      return "Out for Lunch";
    case "LUNCH_IN":
      return "Back from Lunch";
    case "CLOCK_OUT":
      return "Clock Out";
    default:
      return type;
  }
}
