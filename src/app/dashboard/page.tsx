"use client";

import { useEffect, useState } from "react";
import { liff } from "@line/liff";
import { EXPENSE_CATEGORY_LABEL_TH, type ExpenseCategoryValue } from "@/constants/expense-category";

type DashboardExpense = {
  id: string;
  category: ExpenseCategoryValue;
  amount: string;
  note: string | null;
  payerName: string;
  createdAt: string;
};

type DashboardResponse = {
  month: string;
  monthLabel: string;
  hasPrevMonth: boolean;
  hasNextMonth: boolean;
  total: number;
  categoryTotals: Record<ExpenseCategoryValue, number>;
  expenses: DashboardExpense[];
};

function shiftMonthClient(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const token = liff.getIDToken();
        if (!token) {
          setInitError("ไม่สามารถยืนยันตัวตนผ่าน LINE ได้ ลองเปิดใหม่อีกครั้ง");
          return;
        }

        setIdToken(token);
      } catch {
        setInitError("เกิดข้อผิดพลาด ลองเปิดหน้านี้ใหม่อีกครั้ง");
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;

    async function load() {
      setFetchError(null);
      try {
        const url = month ? `/api/dashboard/summary?month=${month}` : "/api/dashboard/summary";
        const response = await fetch(url, {
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
        if (!month) setMonth(json.month);
      } catch {
        if (!cancelled) setFetchError("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [idToken, month]);

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

      <div className="mt-4 flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <button
          type="button"
          disabled={!data.hasPrevMonth}
          onClick={() => setMonth(shiftMonthClient(data.month, -1))}
          className="px-2 py-1 disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-sm font-medium">{data.monthLabel}</span>
        <button
          type="button"
          disabled={!data.hasNextMonth}
          onClick={() => setMonth(shiftMonthClient(data.month, 1))}
          className="px-2 py-1 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <section className="mt-4 rounded-xl bg-neutral-100 p-4 dark:bg-neutral-900">
        <p className="text-sm text-neutral-500">ยอดรวมเดือนนี้</p>
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
        <h2 className="text-sm font-medium text-neutral-500">รายการเดือนนี้</h2>
        <ul className="mt-2 space-y-2">
          {data.expenses.map((expense) => (
            <li key={expense.id} className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
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
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-neutral-500">
      {text}
    </main>
  );
}
