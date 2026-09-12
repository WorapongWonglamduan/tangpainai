-- The same LINE user can now be a member of more than one household (their
-- personal 1:1 household plus any group households they message the bot
-- from). Uniqueness moves from a single lineUserId to the (household,
-- lineUserId) pair; the plain lineUserId index stays for "list every
-- household this person belongs to" lookups.

-- DropIndex
DROP INDEX "household_members_line_user_id_key";

-- CreateIndex
CREATE INDEX "household_members_line_user_id_idx" ON "household_members"("line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_household_id_line_user_id_key" ON "household_members"("household_id", "line_user_id");
