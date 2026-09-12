import { prisma } from "@/lib/prisma";
import { HISTORY_LIST_SIZE } from "@/constants/bot-commands";
import type { ExpenseCategoryValue } from "@/constants/expense-category";
import type { Expense } from "@/generated/prisma/client";

export async function confirmExpenseBatch(batchId: string, memberId: string) {
  const items = await prisma.expense.findMany({
    where: { batchId, paidByMemberId: memberId, confirmed: false },
  });

  if (items.length === 0) {
    return [];
  }

  await prisma.expense.updateMany({
    where: { batchId, paidByMemberId: memberId },
    data: { confirmed: true },
  });

  return items;
}

export async function rejectExpenseBatch(batchId: string, memberId: string): Promise<number> {
  const result = await prisma.expense.deleteMany({
    where: { batchId, paidByMemberId: memberId, confirmed: false },
  });

  return result.count;
}

// Groups the member's recent confirmed rows into their batches, oldest-first, so the
// displayed "1, 2, 3..." numbering stays stable between a ประวัติ listing and a follow-up
// "ยกเลิก <index>" command run right after (as long as nothing new was saved in between).
export async function listRecentConfirmedBatches(
  memberId: string,
  limit: number = HISTORY_LIST_SIZE,
): Promise<Expense[][]> {
  const recentExpenses = await prisma.expense.findMany({
    where: { paidByMemberId: memberId, confirmed: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const batchOrder: string[] = [];
  const batchesById = new Map<string, Expense[]>();
  for (const expense of recentExpenses) {
    if (!batchesById.has(expense.batchId)) {
      batchOrder.push(expense.batchId);
      batchesById.set(expense.batchId, []);
    }
    batchesById.get(expense.batchId)!.push(expense);
  }

  return batchOrder
    .slice(0, limit)
    .reverse()
    .map((batchId) => batchesById.get(batchId)!);
}

export async function cancelExpenseBatchesByIndex(
  memberId: string,
  indices: number[],
): Promise<Expense[]> {
  const batches = await listRecentConfirmedBatches(memberId);

  const toCancel = indices.flatMap((index) => batches[index - 1] ?? []);
  if (toCancel.length === 0) {
    return [];
  }

  await prisma.expense.deleteMany({
    where: { id: { in: toCancel.map((expense) => expense.id) } },
  });

  return toCancel;
}

// Scoped to householdId so a member can only reach expenses in their own household.
export async function getExpenseForHousehold(householdId: string, expenseId: string) {
  return prisma.expense.findFirst({
    where: { id: expenseId, householdId },
    include: { paidByMember: true },
  });
}

// Authorization check for a user who may belong to several households now:
// finds the expense by id alone, then confirms lineUserId has a membership
// row in whichever household it belongs to. Returns null if the expense
// doesn't exist OR the user isn't a member of its household — the caller
// can't distinguish the two, which is the point (no household enumeration).
export async function getExpenseForUser(lineUserId: string, expenseId: string) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { paidByMember: true },
  });
  if (!expense) return null;

  const isMember = await prisma.householdMember.findUnique({
    where: { householdId_lineUserId: { householdId: expense.householdId, lineUserId } },
  });
  if (!isMember) return null;

  return expense;
}

export type ExpenseEditableFields = {
  category: ExpenseCategoryValue;
  amount: number;
  note: string | null;
};

// Corrects a mis-categorized or mis-read expense (e.g. the AI picked the wrong
// category or misread the amount from a slip). Returns null if the expense
// doesn't exist in this household.
export async function updateExpense(householdId: string, expenseId: string, updates: ExpenseEditableFields) {
  const result = await prisma.expense.updateMany({
    where: { id: expenseId, householdId },
    data: updates,
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.expense.findUnique({
    where: { id: expenseId },
    include: { paidByMember: true },
  });
}

// Same authorization shape as getExpenseForUser — verifies lineUserId is a
// member of the expense's household before touching it, since a user can
// now belong to several households and we can no longer assume "their one
// household" from the token alone.
export async function updateExpenseForUser(
  lineUserId: string,
  expenseId: string,
  updates: ExpenseEditableFields,
) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return null;

  const isMember = await prisma.householdMember.findUnique({
    where: { householdId_lineUserId: { householdId: expense.householdId, lineUserId } },
  });
  if (!isMember) return null;

  return updateExpense(expense.householdId, expenseId, updates);
}

export async function cancelLatestExpenseBatch(memberId: string) {
  const latest = await prisma.expense.findFirst({
    where: { paidByMemberId: memberId, confirmed: true },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return [];
  }

  const batch = await prisma.expense.findMany({
    where: { paidByMemberId: memberId, batchId: latest.batchId },
  });

  await prisma.expense.deleteMany({
    where: { paidByMemberId: memberId, batchId: latest.batchId },
  });

  return batch;
}
