/*
  Warnings:

  - Added the required column `batchId` to the `Expense` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "batchId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Expense_batchId_idx" ON "Expense"("batchId");
