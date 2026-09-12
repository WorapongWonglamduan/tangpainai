import { NextResponse } from "next/server";
import { addDays, getBangkokDateString, getDashboardData } from "@/lib/dashboard";
import { verifyLiffIdToken } from "@/lib/liff-auth";
import { lineClient } from "@/lib/line-client";
import { DASHBOARD_PERIOD, type DashboardPeriodValue } from "@/constants/period";
import { EXPENSE_CATEGORY, type ExpenseCategoryValue } from "@/constants/expense-category";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PERIODS = new Set<string>(Object.values(DASHBOARD_PERIOD));
const VALID_CATEGORIES = new Set<string>(Object.values(EXPENSE_CATEGORY));
// Default span shown the first time a member switches to the custom filter,
// before they've picked their own start/end.
const DEFAULT_CUSTOM_RANGE_DAYS = 7;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!idToken) {
    return NextResponse.json({ error: "missing id token" }, { status: 401 });
  }

  const lineUserId = await verifyLiffIdToken(idToken);
  if (!lineUserId) {
    return NextResponse.json({ error: "invalid id token" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const periodParam = searchParams.get("period");
  const period: DashboardPeriodValue =
    periodParam && VALID_PERIODS.has(periodParam) ? (periodParam as DashboardPeriodValue) : DASHBOARD_PERIOD.MONTH;

  const dateParam = searchParams.get("date");
  const anchorDate = dateParam && DATE_PATTERN.test(dateParam) ? dateParam : undefined;

  let customRange: { startDate: string; endDateInclusive: string } | undefined;
  if (period === DASHBOARD_PERIOD.CUSTOM) {
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const start = startParam && DATE_PATTERN.test(startParam) ? startParam : undefined;
    const end = endParam && DATE_PATTERN.test(endParam) ? endParam : undefined;

    customRange =
      start && end
        ? { startDate: start, endDateInclusive: end }
        : { startDate: addDays(getBangkokDateString(), -(DEFAULT_CUSTOM_RANGE_DAYS - 1)), endDateInclusive: getBangkokDateString() };
  }

  // Repeated ?category=RENT&category=FOOD selects multiple categories; an
  // unknown value is dropped rather than rejecting the whole request.
  const categories = searchParams
    .getAll("category")
    .filter((value): value is ExpenseCategoryValue => VALID_CATEGORIES.has(value));

  // Which of the user's households to show. getDashboardData verifies this
  // id actually belongs to lineUserId before scoping any query to it — an
  // unrelated or spoofed id just finds nothing, it can't leak another
  // household's data.
  const householdIdParam = searchParams.get("householdId") ?? undefined;

  const data = await getDashboardData(lineUserId, householdIdParam, period, anchorDate, customRange, categories);
  if (!data) {
    return NextResponse.json({ error: "not a member of any household yet" }, { status: 404 });
  }

  // Group households only store a lineGroupId — resolve a human-readable
  // name from LINE for each one so the room switcher shows "แชทกลุ่ม X"
  // instead of a raw id. Best-effort: if LINE fails to answer for a group
  // (e.g. the bot was removed from it), fall back to a generic label rather
  // than failing the whole dashboard request.
  const rooms = await Promise.all(
    data.memberships.map(async (membership) => {
      if (!membership.isGroup || !membership.lineGroupId) {
        return { householdId: membership.householdId, isGroup: false, name: "ห้องของฉัน" };
      }

      try {
        const summary = await lineClient.getGroupSummary(membership.lineGroupId);
        return { householdId: membership.householdId, isGroup: true, name: summary.groupName };
      } catch {
        return { householdId: membership.householdId, isGroup: true, name: "แชทกลุ่ม" };
      }
    }),
  );

  return NextResponse.json({
    householdId: data.householdId,
    memberName: data.memberName,
    rooms,
    period: data.period,
    anchorDate: data.anchorDate,
    periodLabel: data.periodLabel,
    hasPrevPeriod: data.hasPrevPeriod,
    hasNextPeriod: data.hasNextPeriod,
    prevAnchorDate: data.prevAnchorDate,
    nextAnchorDate: data.nextAnchorDate,
    customStart: data.customStart,
    customEnd: data.customEnd,
    selectedCategories: data.selectedCategories,
    total: data.total,
    categoryTotals: data.categoryTotals,
    lifetimeTotal: data.lifetimeTotal,
    expenses: data.expenses.map((expense) => ({
      id: expense.id,
      category: expense.category,
      amount: expense.amount,
      note: expense.note,
      payerName: expense.paidByMember.displayName ?? "ไม่ทราบชื่อ",
      createdAt: expense.createdAt,
    })),
  });
}
