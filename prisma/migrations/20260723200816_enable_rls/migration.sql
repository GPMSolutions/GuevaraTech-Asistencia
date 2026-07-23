-- Enable Row-Level Security on all public tables.
-- The application connects via Prisma using the postgres (table-owner) role,
-- which bypasses RLS, so app queries are unaffected. Enabling RLS with no
-- policies blocks the anon/authenticated roles used by Supabase's auto-generated
-- API, closing public read/write access to these tables.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deduction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Holiday" ENABLE ROW LEVEL SECURITY;
