-- Enable RLS on Prisma's internal migrations table as well, so no public table
-- is left accessible via Supabase's auto-generated API. Prisma connects as the
-- table owner and bypasses RLS, so migrations continue to work.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
