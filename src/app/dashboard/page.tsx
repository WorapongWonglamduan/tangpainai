"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EXPENSE_CATEGORY_LABEL_TH, type ExpenseCategoryValue } from "@/constants/expense-category";
import {
  DASHBOARD_PERIOD_LABEL_TH,
  DASHBOARD_PERIOD_OPTIONS,
  type DashboardPeriodValue,
} from "@/constants/period";
import { useLiffIdToken } from "@/hooks/use-liff-id-token";
import { CenteredMessage } from "@/components/centered-message";

type DashboardExpense = {
  id: string;
  category: ExpenseCategoryValue;
  amount: string;
  note: string | null;
  payerName: string;
  createdAt: string;
};

type DashboardResponse = {
  period: DashboardPeriodValue;
  anchorDate: string;
  periodLabel: string;
  hasPrevPeriod: boolean;
  hasNextPeriod: boolean;
  prevAnchorDate: string;
  nextAnchorDate: string;
  total: number;
  categoryTotals: Record<ExpenseCategoryValue, number>;
  expenses: DashboardExpense[];
};

export default function DashboardPage() {
  const { idToken, error: initError } = useLiffIdToken();
  const [period, setPeriod] = useState<DashboardPeriodValue>(DASHBOARD_PERIOD_OPTIONS[3]);
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;

    async function load() {
      setFetchError(null);
      try {
        const params = new URLSearchParams({ period });
        if (anchorDate) params.set("date", anchorDate);

        const response = await fetch(`/api/dashboard/summary?${params}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (cancelled) return;

        if (response.status === 404) {
          setFetchError("ยังไม่มีข้อมูลค่าใช้จ่าย ลองพิมพ์หรือส่งสลิปในแชทบอทก่อน");
          return;
        }

        if (!response.ok) {
          setFetchError("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
          return;
        }

        const json = (await response.json()) as DashboardResponse;
        setData(json);
      } catch {
        if (!cancelled) setFetchError("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [idToken, period, anchorDate]);

  function selectPeriod(next: DashboardPeriodValue) {
    setPeriod(next);
    setAnchorDate(null); // switching period type always starts from "today"
  }

  if (initError) {
    return <CenteredMessage text={initError} />;
  }

  if (fetchError) {
    return <CenteredMessage text={fetchError} />;
  }

  if (!data) {
    return <CenteredMessage text="กำลังโหลด..." />;
  }

  const categoryEntries = Object.entries(data.categoryTotals) as [ExpenseCategoryValue, number][];

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-lg font-semibold">สรุปค่าใช้จ่ายบ้าน</h1>

      <div className="mt-4 flex gap-2 overflow-x-auto">
        {DASHBOARD_PERIOD_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => selectPeriod(option)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              option === data.period
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900"
            }`}
          >
            {DASHBOARD_PERIOD_LABEL_TH[option]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <button
          type="button"
          disabled={!data.hasPrevPeriod}
          onClick={() => setAnchorDate(data.prevAnchorDate)}
          className="px-2 py-1 disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-sm font-medium">{data.periodLabel}</span>
        <button
          type="button"
          disabled={!data.hasNextPeriod}
          onClick={() => setAnchorDate(data.nextAnchorDate)}
          className="px-2 py-1 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <section className="mt-4 rounded-xl bg-neutral-100 p-4 dark:bg-neutral-900">
        <p className="text-sm text-neutral-500">ยอดรวมช่วงนี้</p>
        <p className="text-2xl font-bold">{data.total.toLocaleString("th-TH")} บาท</p>
      </section>

      <section className="mt-4">
        <h2 className="text-sm font-medium text-neutral-500">แยกตามหมวด</h2>
        <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
          {categoryEntries
            .filter(([, amount]) => amount > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([category, amount]) => (
              <li key={category} className="flex justify-between py-2 text-sm">
                <span>{EXPENSE_CATEGORY_LABEL_TH[category]}</span>
                <span className="font-medium">{amount.toLocaleString("th-TH")} บาท</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-neutral-500">รายการช่วงนี้</h2>
        <ul className="mt-2 space-y-2">
          {data.expenses.map((expense) => (
            <li key={expense.id}>
              <Link
                href={`/dashboard/expense/${expense.id}`}
                className="block rounded-lg border border-neutral-200 p-3 text-sm active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{EXPENSE_CATEGORY_LABEL_TH[expense.category]}</span>
                  <span>{Number(expense.amount).toLocaleString("th-TH")} บาท</span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-neutral-500">
                  <span>
                    {expense.payerName}
                    {expense.note ? ` · ${expense.note}` : ""}
                  </span>
                  <span>
                    {new Date(expense.createdAt).toLocaleString("th-TH", {
                      timeZone: "Asia/Bangkok",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
