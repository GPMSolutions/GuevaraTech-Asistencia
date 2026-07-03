import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || session.user.id;

  if (userId !== session.user.id && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: { userId: string; timestamp?: { gte?: Date; lte?: Date } } = { userId };
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = new Date(startDate);
    if (endDate) where.timestamp.lte = new Date(endDate);
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    orderBy: { timestamp: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type } = body as { type: string };

  const validTypes = ["CLOCK_IN", "LUNCH_OUT", "LUNCH_IN", "CLOCK_OUT"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEntries = await prisma.timeEntry.findMany({
    where: {
      userId: session.user.id,
      timestamp: { gte: todayStart },
    },
    orderBy: { timestamp: "desc" },
  });

  const lastEntry = todayEntries[0];
  const allowedActions = getAllowedActions(lastEntry?.type);

  if (!allowedActions.includes(type)) {
    return NextResponse.json(
      { error: `Invalid action. Allowed: ${allowedActions.map(formatActionLabel).join(", ")}` },
      { status: 400 }
    );
  }

  const entry = await prisma.timeEntry.create({
    data: {
      userId: session.user.id,
      type,
      timestamp: new Date(),
    },
  });

  return NextResponse.json(entry, { status: 201 });
}

function getAllowedActions(lastType: string | undefined): string[] {
  if (!lastType || lastType === "CLOCK_OUT") return ["CLOCK_IN"];
  switch (lastType) {
    case "CLOCK_IN":
      return ["LUNCH_OUT", "CLOCK_OUT"];
    case "LUNCH_OUT":
      return ["LUNCH_IN"];
    case "LUNCH_IN":
      return ["LUNCH_OUT", "CLOCK_OUT"];
    default:
      return ["CLOCK_IN"];
  }
}

function formatActionLabel(type: string): string {
  switch (type) {
    case "CLOCK_IN": return "Clock In";
    case "LUNCH_OUT": return "Out for Lunch";
    case "LUNCH_IN": return "Back from Lunch";
    case "CLOCK_OUT": return "Clock Out";
    default: return type;
  }
}
