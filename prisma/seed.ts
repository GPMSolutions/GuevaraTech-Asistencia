import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await hash("password123", 12);

  const manager = await prisma.user.upsert({
    where: { email: "manager@company.com" },
    update: {},
    create: {
      email: "manager@company.com",
      name: "Sarah Manager",
      password,
      role: "MANAGER",
      department: "Operations",
    },
  });

  const john = await prisma.user.upsert({
    where: { email: "john@company.com" },
    update: {},
    create: {
      email: "john@company.com",
      name: "John Smith",
      password,
      role: "EMPLOYEE",
      department: "Engineering",
    },
  });

  const jane = await prisma.user.upsert({
    where: { email: "jane@company.com" },
    update: {},
    create: {
      email: "jane@company.com",
      name: "Jane Doe",
      password,
      role: "EMPLOYEE",
      department: "Design",
    },
  });

  const mike = await prisma.user.upsert({
    where: { email: "mike@company.com" },
    update: {},
    create: {
      email: "mike@company.com",
      name: "Mike Johnson",
      password,
      role: "EMPLOYEE",
      department: "Engineering",
    },
  });

  const employees = [john, jane, mike];
  const now = new Date();

  for (const emp of employees) {
    for (let dayOffset = 6; dayOffset >= 1; dayOffset--) {
      const day = new Date(now);
      day.setDate(now.getDate() - dayOffset);

      if (day.getDay() === 0 || day.getDay() === 6) continue;

      const clockIn = new Date(day);
      clockIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0, 0);

      const lunchOut = new Date(day);
      lunchOut.setHours(12, Math.floor(Math.random() * 30), 0, 0);

      const lunchIn = new Date(day);
      lunchIn.setHours(13, Math.floor(Math.random() * 15), 0, 0);

      const clockOut = new Date(day);
      clockOut.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0, 0);

      await prisma.timeEntry.createMany({
        data: [
          { userId: emp.id, type: "CLOCK_IN", timestamp: clockIn },
          { userId: emp.id, type: "LUNCH_OUT", timestamp: lunchOut },
          { userId: emp.id, type: "LUNCH_IN", timestamp: lunchIn },
          { userId: emp.id, type: "CLOCK_OUT", timestamp: clockOut },
        ],
      });
    }
  }

  console.log("Seeded:", { manager: manager.email, employees: employees.map(e => e.email) });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
