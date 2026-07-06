import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPassword = await hash("admin123", 12);
  const employeePassword = await hash("empleado123", 12);
  const kioskPassword = await hash("trabajadores123", 12);

  // Create admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@guevaratech.com" },
    update: {},
    create: {
      email: "admin@guevaratech.com",
      name: "Administrador",
      password: adminPassword,
      role: "ADMIN",
      monthlySalary: 0,
    },
  });

  // Shared kiosk account for all workers to clock in/out
  const kiosk = await prisma.user.upsert({
    where: { email: "trabajadores@guevaratech.com" },
    update: {},
    create: {
      email: "trabajadores@guevaratech.com",
      name: "Trabajadores",
      password: kioskPassword,
      role: "KIOSK",
      monthlySalary: 0,
    },
  });

  // Create sample employees
  const emp1 = await prisma.user.upsert({
    where: { email: "carlos@guevaratech.com" },
    update: {},
    create: {
      email: "carlos@guevaratech.com",
      name: "Carlos Pérez",
      password: employeePassword,
      role: "EMPLOYEE",
      monthlySalary: 1130.0,
    },
  });

  const emp2 = await prisma.user.upsert({
    where: { email: "maria@guevaratech.com" },
    update: {},
    create: {
      email: "maria@guevaratech.com",
      name: "María García",
      password: employeePassword,
      role: "EMPLOYEE",
      monthlySalary: 1130.0,
    },
  });

  const emp3 = await prisma.user.upsert({
    where: { email: "juan@guevaratech.com" },
    update: {},
    create: {
      email: "juan@guevaratech.com",
      name: "Juan López",
      password: employeePassword,
      role: "EMPLOYEE",
      monthlySalary: 1130.0,
    },
  });

  const employees = [emp1, emp2, emp3];
  const now = new Date();

  // Generate sample attendance for the past 2 weeks (Mon-Sat only)
  for (const emp of employees) {
    for (let dayOffset = 13; dayOffset >= 1; dayOffset--) {
      const day = new Date(now);
      day.setDate(now.getDate() - dayOffset);

      // Skip Sundays (day 0)
      if (day.getDay() === 0) continue;

      // Randomly skip a day (simulate absences)
      if (Math.random() < 0.1) continue;

      const clockIn = new Date(day);
      clockIn.setHours(8 + Math.floor(Math.random() * 1), Math.floor(Math.random() * 30), 0, 0);

      const lunchOut = new Date(day);
      lunchOut.setHours(12, Math.floor(Math.random() * 30), 0, 0);

      const lunchIn = new Date(day);
      lunchIn.setHours(13, Math.floor(Math.random() * 15), 0, 0);

      const clockOut = new Date(day);
      clockOut.setHours(17, Math.floor(Math.random() * 30), 0, 0);

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

  console.log("Seed completado:", {
    admin: admin.email,
    kiosk: kiosk.email,
    empleados: employees.map((e) => e.email),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
