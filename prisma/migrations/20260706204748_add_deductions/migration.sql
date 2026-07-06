-- CreateTable
CREATE TABLE "Deduction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deduction_userId_idx" ON "Deduction"("userId");

-- CreateIndex
CREATE INDEX "Deduction_userId_year_month_idx" ON "Deduction"("userId", "year", "month");

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
