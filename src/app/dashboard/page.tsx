"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  EXPENSE_CATEGORY_ICON,
  EXPENSE_CATEGORY_LABEL_TH,
  EXPENSE_CATEGORY_STYLE,
  type ExpenseCategoryValue,
} from "@/constants/expense-category";
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

  const categoryEntries = (Object.entries(data.categoryTotals) as [ExpenseCategoryValue, number][])
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-surface px-4 py-6 text-on-surface">
      <h1 className="text-lg font-semibold">สรุปค่าใช้จ่ายบ้าน</h1>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {DASHBOARD_PERIOD_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => selectPeriod(option)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors active:scale-95 ${
              option === data.period
                ? "bg-primary text-on-primary shadow-sm shadow-primary/30"
                : "bg-surface-container text-on-surface-variant"
            }`}
          >
            {DASHBOARD_PERIOD_LABEL_TH[option]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-container-lowest px-3 py-2 shadow-sm">
        <button
          type="button"
          disabled={!data.hasPrevPeriod}
          onClick={() => setAnchorDate(data.prevAnchorDate)}
          className="px-2 py-1 text-on-surface-variant disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-sm font-medium">{data.periodLabel}</span>
        <button
          type="button"
          disabled={!data.hasNextPeriod}
          onClick={() => setAnchorDate(data.nextAnchorDate)}
          className="px-2 py-1 text-on-surface-variant disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <label className="mt-2 flex items-center gap-2 rounded-xl bg-surface-container-lowest px-3 py-2 text-sm shadow-sm">
        <span className="text-on-surface-variant">📅 ไปวันที่</span>
        <input
          type="date"
          value={data.anchorDate}
          onChange={(e) => e.target.value && setAnchorDate(e.target.value)}
          className="flex-1 bg-transparent text-on-surface outline-none [color-scheme:light] dark:[color-scheme:dark]"
        />
      </label>

      <section className="mt-4 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
        <p className="text-sm text-on-surface-variant">ยอดรวมช่วงนี้</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-primary">
          ฿{data.total.toLocaleString("th-TH")}
        </p>
      </section>

      {categoryEntries.length > 0 && (
        <section className="mt-4 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-on-surface-variant">แยกตามหมวด</h2>

          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
            {categoryEntries.map(([category, amount]) => (
              <div
                key={category}
                className={EXPENSE_CATEGORY_STYLE[category].bar}
                style={{ width: `${(amount / data.total) * 100}%` }}
              />
            ))}
          </div>

          <ul className="mt-3 space-y-2">
            {categoryEntries.map(([category, amount]) => (
              <li key={category} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${EXPENSE_CATEGORY_STYLE[category].badge}`}
                  >
                    {EXPENSE_CATEGORY_ICON[category]}
                  </span>
                  {EXPENSE_CATEGORY_LABEL_TH[category]}
                </span>
                <span className="font-medium">฿{amount.toLocaleString("th-TH")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-on-surface-variant">รายการช่วงนี้</h2>
        <ul className="mt-2 space-y-2">
          {data.expenses.map((expense) => (
            <li key={expense.id}>
              <Link
                href={`/dashboard/expense/${expense.id}`}
                className="flex items-center gap-3 rounded-xl bg-surface-container-lowest p-3 shadow-sm transition-colors active:bg-surface-container-low"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${EXPENSE_CATEGORY_STYLE[expense.category].badge}`}
                >
                  {EXPENSE_CATEGORY_ICON[expense.category]}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {expense.note || EXPENSE_CATEGORY_LABEL_TH[expense.category]}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${EXPENSE_CATEGORY_STYLE[expense.category].badge}`}
                    >
                      {EXPENSE_CATEGORY_LABEL_TH[expense.category]}
                    </span>
                    <span>{expense.payerName}</span>
                    <span>
                      ·{" "}
                      {new Date(expense.createdAt).toLocaleString("th-TH", {
                        timeZone: "Asia/Bangkok",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <span className="shrink-0 text-sm font-semibold">
                  ฿{Number(expense.amount).toLocaleString("th-TH")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
