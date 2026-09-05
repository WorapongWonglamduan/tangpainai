import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard";
import { verifyLiffIdToken } from "@/lib/liff-auth";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

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
  const monthParam = searchParams.get("month");
  const month = monthParam && MONTH_PATTERN.test(monthParam) ? monthParam : undefined;

  const data = await getDashboardData(lineUserId, month);
  if (!data) {
    return NextResponse.json({ error: "not a member of any household yet" }, { status: 404 });
  }

  return NextResponse.json({
    month: data.month,
    monthLabel: data.monthLabel,
    hasPrevMonth: data.hasPrevMonth,
    hasNextMonth: data.hasNextMonth,
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
