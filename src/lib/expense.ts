import { prisma } from "@/lib/prisma";
import { HISTORY_LIST_SIZE } from "@/constants/bot-commands";
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
