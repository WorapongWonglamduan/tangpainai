import { prisma } from "@/lib/prisma";
import { EXPENSE_CATEGORY, type ExpenseCategoryValue } from "@/constants/expense-category";
import { CUSTOM_RANGE_MAX_DAYS, DASHBOARD_PERIOD, type DashboardPeriodValue } from "@/constants/period";

const BANGKOK_TZ = "Asia/Bangkok";
// A known Monday, used only as a stable reference point so biweekly blocks
// land on the same 14-day boundaries every time (never shown to users).
const BIWEEKLY_EPOCH = "2024-01-01";

// "YYYY-MM-DD" in Asia/Bangkok, independent of the host machine's timezone.
export function getBangkokDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

function parseDateParts(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

function formatDateString(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseDateParts(dateStr);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return formatDateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = parseDateParts(fromDateStr);
  const to = parseDateParts(toDateStr);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(to.y, to.m - 1, to.d) - Date.UTC(from.y, from.m - 1, from.d)) / msPerDay);
}

// The UTC instant of Bangkok (UTC+7) midnight for a "YYYY-MM-DD" date string.
function bangkokMidnight(dateStr: string): Date {
  const { y, m, d } = parseDateParts(dateStr);
  return new Date(Date.UTC(y, m - 1, d, -7, 0, 0));
}

// Monday of the ISO week containing dateStr.
function startOfIsoWeek(dateStr: string): string {
  const { y, m, d } = parseDateParts(dateStr);
  const jsDayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const isoDayOfWeek = jsDayOfWeek === 0 ? 7 : jsDayOfWeek; // 1=Mon..7=Sun
  return addDays(dateStr, -(isoDayOfWeek - 1));
}

function startOfBiweekly(dateStr: string): string {
  const weekStart = startOfIsoWeek(dateStr);
  const blockIndex = Math.floor(daysBetween(BIWEEKLY_EPOCH, weekStart) / 14);
  return addDays(BIWEEKLY_EPOCH, blockIndex * 14);
}

function startOfMonth(dateStr: string): string {
  const { y, m } = parseDateParts(dateStr);
  return formatDateString(y, m, 1);
}

function addMonths(dateStr: string, months: number): string {
  const { y, m, d } = parseDateParts(dateStr);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return formatDateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

// The exclusive [startDate, endDate) range for the period containing anchorDate.
// Every period type produces contiguous, non-overlapping blocks, so shifting the
// anchor to endDate (next) or startDate - 1 day (prev) always lands in the
// adjacent block regardless of period type.
function getPeriodRange(period: DashboardPeriodValue, anchorDate: string): { startDate: string; endDate: string } {
  switch (period) {
    case DASHBOARD_PERIOD.DAY:
    // No explicit range was given for a custom period — fall back to a single day.
    case DASHBOARD_PERIOD.CUSTOM:
      return { startDate: anchorDate, endDate: addDays(anchorDate, 1) };
    case DASHBOARD_PERIOD.WEEK: {
      const startDate = startOfIsoWeek(anchorDate);
      return { startDate, endDate: addDays(startDate, 7) };
    }
    case DASHBOARD_PERIOD.BIWEEKLY: {
      const startDate = startOfBiweekly(anchorDate);
      return { startDate, endDate: addDays(startDate, 14) };
    }
    case DASHBOARD_PERIOD.MONTH: {
      const startDate = startOfMonth(anchorDate);
      return { startDate, endDate: addMonths(startDate, 1) };
    }
  }
}

// Orders the two picked dates and caps the span so a custom range can't
// balloon into an unbounded query.
function normalizeCustomRange(startDate: string, endDateInclusive: string): { startDate: string; endDate: string } {
  const [rangeStart, rangeEndInclusive] = startDate <= endDateInclusive ? [startDate, endDateInclusive] : [endDateInclusive, startDate];
  const cappedEndInclusive =
    daysBetween(rangeStart, rangeEndInclusive) >= CUSTOM_RANGE_MAX_DAYS
      ? addDays(rangeStart, CUSTOM_RANGE_MAX_DAYS - 1)
      : rangeEndInclusive;

  return { startDate: rangeStart, endDate: addDays(cappedEndInclusive, 1) };
}

function formatShortDateTH(dateStr: string, withYear: boolean): string {
  const { y, m, d } = parseDateParts(dateStr);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

function formatPeriodLabelTH(period: DashboardPeriodValue, startDate: string, endDateExclusive: string): string {
  if (period === DASHBOARD_PERIOD.MONTH) {
    const { y, m } = parseDateParts(startDate);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  }

  if (period === DASHBOARD_PERIOD.DAY) {
    return formatShortDateTH(startDate, true);
  }

  // WEEK / BIWEEKLY / CUSTOM: endDateExclusive is the day after the period, so
  // the last visible day is one day before it.
  const lastDate = addDays(endDateExclusive, -1);
  const sameYear = parseDateParts(startDate).y === parseDateParts(lastDate).y;
  return `${formatShortDateTH(startDate, !sameYear)} – ${formatShortDateTH(lastDate, true)}`;
}

export async function getDashboardData(
  lineUserId: string,
  period: DashboardPeriodValue = DASHBOARD_PERIOD.MONTH,
  anchorDate?: string,
  customRange?: { startDate: string; endDateInclusive: string },
) {
  const member = await prisma.householdMember.findUnique({
    where: { lineUserId },
    include: { household: true },
  });

  if (!member) {
    return null;
  }

  const isCustom = period === DASHBOARD_PERIOD.CUSTOM;
  const targetAnchor = anchorDate ?? getBangkokDateString();

  const { startDate, endDate } =
    isCustom && customRange
      ? normalizeCustomRange(customRange.startDate, customRange.endDateInclusive)
      : getPeriodRange(period, targetAnchor);
  const start = bangkokMidnight(startDate);
  const end = bangkokMidnight(endDate);

  // Custom ranges don't have a natural "current block" to compare against —
  // paging is done by editing the two dates directly, not by stepping blocks.
  const hasNextPeriod = isCustom ? startDate < getBangkokDateString() : startDate < getPeriodRange(period, getBangkokDateString()).startDate;

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
    memberName: member.displayName ?? "ไม่ทราบชื่อ",
    period,
    anchorDate: startDate,
    periodLabel: formatPeriodLabelTH(period, startDate, endDate),
    hasPrevPeriod: earlierCount > 0,
    hasNextPeriod,
    prevAnchorDate: addDays(startDate, -1),
    nextAnchorDate: endDate,
    customStart: isCustom ? startDate : null,
    customEnd: isCustom ? addDays(endDate, -1) : null,
    total,
    categoryTotals,
    expenses,
  };
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
