import { prisma } from "@/lib/prisma";
import { EXPENSE_CATEGORY, type ExpenseCategoryValue } from "@/constants/expense-category";

// "YYYY-MM" in Asia/Bangkok, independent of the host machine's timezone.
export function getBangkokMonth(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthRangeBangkok(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  // Date.UTC rolls the date back correctly for a negative hour, giving the UTC
  // instant of Bangkok (UTC+7) midnight on the 1st without a timezone library.
  const start = new Date(Date.UTC(y, m - 1, 1, -7, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, -7, 0, 0));
  return { start, end };
}

function formatMonthLabelTH(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export async function getDashboardData(lineUserId: string, month?: string) {
  const member = await prisma.householdMember.findUnique({
    where: { lineUserId },
    include: { household: true },
  });

  if (!member) {
    return null;
  }

  const targetMonth = month ?? getBangkokMonth();
  const { start, end } = monthRangeBangkok(targetMonth);

  const [expenses, earlierCount] = await Promise.all([
    prisma.expense.findMany({
      where: {
        householdId: member.householdId,
        confirmed: true,
        occurredAt: { gte: start, lt: end },
      },
      orderBy: { occurredAt: "desc" },
      include: { paidByMember: true },
    }),
    prisma.expense.count({
      where: { householdId: member.householdId, confirmed: true, occurredAt: { lt: start } },
    }),
  ]);

  const categoryTotals = Object.fromEntries(
    Object.values(EXPENSE_CATEGORY).map((category) => [category, 0]),
  ) as Record<ExpenseCategoryValue, number>;

  let total = 0;
  for (const expense of expenses) {
    const amount = Number(expense.amount);
    categoryTotals[expense.category] += amount;
    total += amount;
  }

  return {
    householdId: member.household.id,
    currentMemberId: member.id,
    month: targetMonth,
    monthLabel: formatMonthLabelTH(targetMonth),
    hasPrevMonth: earlierCount > 0,
    hasNextMonth: targetMonth < getBangkokMonth(),
    total,
    categoryTotals,
    expenses,
  };
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
