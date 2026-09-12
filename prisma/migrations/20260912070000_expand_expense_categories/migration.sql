-- AlterEnum
-- Renames AI to SUBSCRIPTION (broader: any recurring paid service, not just AI
-- tools like Claude/ChatGPT — also covers Netflix, Spotify, etc). Existing
-- rows keep their data; only the enum label changes.
-- Note: the Postgres type is "expense_category" (snake_case, via @@map), not
-- "ExpenseCategory" — see migration 20260905063752_snake_case_db_naming.
ALTER TYPE "expense_category" RENAME VALUE 'AI' TO 'SUBSCRIPTION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "expense_category" ADD VALUE 'GROCERIES';
ALTER TYPE "expense_category" ADD VALUE 'TRANSPORT';
ALTER TYPE "expense_category" ADD VALUE 'HOUSEHOLD';
ALTER TYPE "expense_category" ADD VALUE 'HEALTH';
ALTER TYPE "expense_category" ADD VALUE 'SHOPPING';
ALTER TYPE "expense_category" ADD VALUE 'ENTERTAINMENT';
