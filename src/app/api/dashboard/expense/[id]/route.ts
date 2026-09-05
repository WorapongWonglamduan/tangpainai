import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/liff-auth";
import { getExpenseForHousehold, updateExpense } from "@/lib/expense";
import { EXPENSE_CATEGORY, type ExpenseCategoryValue } from "@/constants/expense-category";

const categoryValues = Object.values(EXPENSE_CATEGORY) as [ExpenseCategoryValue, ...ExpenseCategoryValue[]];

const UpdateExpenseSchema = z.object({
  category: z.enum(categoryValues),
  amount: z.coerce.number().positive(),
  note: z.string().trim().max(200).nullable(),
});

async function resolveHouseholdMember(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!idToken) return null;

  const lineUserId = await verifyLiffIdToken(idToken);
  if (!lineUserId) return null;

  return prisma.householdMember.findUnique({ where: { lineUserId } });
}

export async function GET(request: Request, ctx: RouteContext<"/api/dashboard/expense/[id]">) {
  const member = await resolveHouseholdMember(request);
  if (!member) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const expense = await getExpenseForHousehold(member.householdId, id);
  if (!expense) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: expense.id,
    category: expense.category,
    amount: expense.amount,
    note: expense.note,
    payerName: expense.paidByMember.displayName ?? "ไม่ทราบชื่อ",
    createdAt: expense.createdAt,
  });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/dashboard/expense/[id]">) {
  const member = await resolveHouseholdMember(request);
  if (!member) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const updated = await updateExpense(member.householdId, id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    category: updated.category,
    amount: updated.amount,
    note: updated.note,
    payerName: updated.paidByMember.displayName ?? "ไม่ทราบชื่อ",
    createdAt: updated.createdAt,
  });
}
