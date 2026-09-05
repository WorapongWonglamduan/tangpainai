/*
  Warnings:

  - You are about to drop the `Expense` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Household` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `HouseholdMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "expense_category" AS ENUM ('RENT', 'UTILITIES', 'INTERNET', 'AI', 'FOOD', 'OTHER');

-- CreateEnum
CREATE TYPE "expense_source" AS ENUM ('TEXT', 'IMAGE');

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_householdId_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_paidByMemberId_fkey";

-- DropForeignKey
ALTER TABLE "HouseholdMember" DROP CONSTRAINT "HouseholdMember_householdId_fkey";

-- DropTable
DROP TABLE "Expense";

-- DropTable
DROP TABLE "Household";

-- DropTable
DROP TABLE "HouseholdMember";

-- DropEnum
DROP TYPE "ExpenseCategory";

-- DropEnum
DROP TYPE "ExpenseSource";

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "line_group_id" TEXT,
    "line_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "paid_by_member_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "category" "expense_category" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "merchant" TEXT,
    "note" TEXT,
    "source_type" "expense_source" NOT NULL,
    "raw_slip_image_url" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "households_line_group_id_key" ON "households"("line_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "households_line_user_id_key" ON "households"("line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_line_user_id_key" ON "household_members"("line_user_id");

-- CreateIndex
CREATE INDEX "expenses_batch_id_idx" ON "expenses"("batch_id");

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_member_id_fkey" FOREIGN KEY ("paid_by_member_id") REFERENCES "household_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
