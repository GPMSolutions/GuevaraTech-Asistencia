import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPeruHolidays } from "@/lib/holidays";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const holidays = getPeruHolidays(year).map((h) => ({
    date: h.date.toISOString().split("T")[0],
    name: h.name,
  }));

  return NextResponse.json({ year, holidays });
}
