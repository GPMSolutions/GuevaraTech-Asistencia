# GuevaraTech - Sistema de Control de Asistencia

**Employee attendance & payroll web app** for a small business in Peru. Employees clock in/out (including lunch breaks) and administrators manage employees, view attendance reports, and calculate monthly payroll following Peruvian labor rules.

> Built as a prototype for the ED1/ED2 project using AI coding tools (Devin, Claude Code). Nearly all code was generated with AI and iterated through GitHub pull requests.

## Links

- **Deployed application:** _TODO – add Vercel/Netlify URL_
- **Demo video (YouTube, unlisted):** _TODO – add link_
- **Repository:** https://github.com/GPMSolutions/GuevaraTech-Asistencia

## What the application does

### Administrator
- Add, edit, and deactivate employees (CRUD on the `User` table)
- Reset employee passwords
- Manage holidays and deductions
- View attendance reports (weekly / monthly), hours shown as `Xh Ym`
- Calculate and export payroll (CSV / PDF)

### Employee
- Log in / log out
- Clock in, lunch out / lunch in, clock out
- View the day's activity
- Kiosk mode for a shared tablet at the entrance

Users must be authenticated before creating or modifying any data. Admin-only API routes check the user's role on the server.

## Technologies used

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes, Prisma ORM 7 |
| Database | **Supabase** (managed PostgreSQL) with Row-Level Security enabled on all tables |
| Authentication | NextAuth.js (credentials provider, bcrypt-hashed passwords) |
| Hosting | Vercel |
| AI tools | Devin, Claude Code |

### Database tables (Supabase / Prisma)

- `User` – employees and admins (email, hashed password, role, monthly salary)
- `TimeEntry` – clock in / lunch out / lunch in / clock out events
- `Deduction` – per-month deductions per employee
- `Holiday` – Peruvian legal holidays (paid 3x when worked)

Schema: [`prisma/schema.prisma`](prisma/schema.prisma). Migrations: [`prisma/migrations`](prisma/migrations).

## Project structure

```
src/
  app/
    login/          # login page
    dashboard/      # employee clock in/out
    admin/          # admin pages: employees, reports, payroll
    kiosk/          # shared-device clock-in
    api/            # REST endpoints (auth, employees, time-entries,
                    #   payroll, reports, holidays, deductions, kiosk)
  lib/              # auth config, prisma client, payroll rules
prisma/
  schema.prisma     # database models
  migrations/       # SQL migrations (incl. RLS policies)
  seed.ts           # test data
```

## Payroll rules (Peru)

- **Monthly salary**: S/ 1,130.00 per employee by default (editable per employee)
- **Daily rate**: monthly salary / days in the month (30 or 31)
- **Schedule**: Monday–Saturday, 8 h/day, 48 h/week
- **Sunday pay**: proportional to days worked that week (6/6 = full, 5/6 = 5/6, ...)
- **Holidays**: working on a holiday pays triple (regular + 2 extra)
- **16 Peruvian legal holidays** included

## Setup instructions

### Prerequisites
- Node.js 20+
- A free [Supabase](https://supabase.com) project (or any PostgreSQL database)

### Steps

1. Clone the repository
   ```bash
   git clone https://github.com/GPMSolutions/GuevaraTech-Asistencia.git
   cd GuevaraTech-Asistencia
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Configure environment variables
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL` – Supabase connection string (Project Settings → Database → Connection string, URI)
   - `NEXTAUTH_SECRET` – any long random string (`openssl rand -base64 32`)
   - `NEXTAUTH_URL` – `http://localhost:3000` locally, or your deployed URL
4. Run migrations (creates the tables in Supabase)
   ```bash
   npx prisma migrate deploy
   ```
5. (Optional) Load test data
   ```bash
   npm run db:seed
   ```
6. Start the dev server
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

### Test accounts (after seed)

- **Admin**: admin@guevaratech.com / admin123
- **Employee**: carlos@guevaratech.com / empleado123

## Deployment

Deployed on Vercel: import the GitHub repo, set the three environment variables above (`NEXTAUTH_URL` = the Vercel URL), and deploy. The build command (`prisma generate && next build`) is already configured in `package.json`.
