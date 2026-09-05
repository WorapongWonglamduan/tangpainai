import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard";
import { verifyLiffIdToken } from "@/lib/liff-auth";
import { DASHBOARD_PERIOD, type DashboardPeriodValue } from "@/constants/period";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PERIODS = new Set<string>(Object.values(DASHBOARD_PERIOD));

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

  const data = await getDashboardData(lineUserId, period, anchorDate);
  if (!data) {
    return NextResponse.json({ error: "not a member of any household yet" }, { status: 404 });
  }

  return NextResponse.json({
    period: data.period,
    anchorDate: data.anchorDate,
    periodLabel: data.periodLabel,
    hasPrevPeriod: data.hasPrevPeriod,
    hasNextPeriod: data.hasNextPeriod,
    prevAnchorDate: data.prevAnchorDate,
    nextAnchorDate: data.nextAnchorDate,
    total: data.total,
    categoryTotals: data.categoryTotals,
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
