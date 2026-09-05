"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { EXPENSE_CATEGORY, EXPENSE_CATEGORY_LABEL_TH, type ExpenseCategoryValue } from "@/constants/expense-category";
import { useLiffIdToken } from "@/hooks/use-liff-id-token";
import { CenteredMessage } from "@/components/centered-message";
import { Icon } from "@/components/icon";

type ExpenseDetail = {
  id: string;
  category: ExpenseCategoryValue;
  amount: string;
  note: string | null;
  payerName: string;
  createdAt: string;
};

const CATEGORY_OPTIONS = Object.values(EXPENSE_CATEGORY);

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { idToken, error: initError } = useLiffIdToken();

  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [category, setCategory] = useState<ExpenseCategoryValue>(EXPENSE_CATEGORY.OTHER);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/dashboard/expense/${id}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (cancelled) return;

        if (!response.ok) {
          setLoadError(response.status === 404 ? "ไม่พบรายการนี้" : "โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
          return;
        }

        const json = (await response.json()) as ExpenseDetail;
        setExpense(json);
        setCategory(json.category);
        setAmount(json.amount);
        setNote(json.note ?? "");
      } catch {
        if (!cancelled) setLoadError("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [idToken, id]);

  async function handleSave() {
    if (!idToken) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      const response = await fetch(`/api/dashboard/expense/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ category, amount, note: note.trim() || null }),
      });

      if (!response.ok) {
        setSaveError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }

      const json = (await response.json()) as ExpenseDetail;
      setExpense(json);
      setSaved(true);
    } catch {
      setSaveError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  if (initError) {
    return <CenteredMessage text={initError} />;
  }

  if (loadError) {
    return <CenteredMessage text={loadError} />;
  }

  if (!expense) {
    return <CenteredMessage text="กำลังโหลด..." />;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-surface px-4 py-6 text-on-surface">
      <Link href="/dashboard" className="flex items-center gap-0.5 text-sm text-on-surface-variant">
        <Icon name="chevron_left" className="text-[18px]" />
        กลับ
      </Link>

      <h1 className="mt-2 text-lg font-semibold">แก้ไขรายการ</h1>
      <p className="mt-1 text-xs text-on-surface-variant">
        จ่ายโดย {expense.payerName} ·{" "}
        {new Date(expense.createdAt).toLocaleString("th-TH", {
          timeZone: "Asia/Bangkok",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>

      <div className="mt-4 space-y-4 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
        <label className="block text-sm">
          <span className="text-on-surface-variant">หมวดหมู่</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategoryValue)}
            className="mt-1 w-full rounded-lg bg-surface-container-low px-3 py-2 text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {EXPENSE_CATEGORY_LABEL_TH[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-on-surface-variant">จำนวนเงิน (บาท)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-container-low px-3 py-2 text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <label className="block text-sm">
          <span className="text-on-surface-variant">โน้ต</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            className="mt-1 w-full rounded-lg bg-surface-container-low px-3 py-2 text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        {saved && <p className="text-sm text-primary">บันทึกแล้ว</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !amount}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-on-primary transition-transform active:scale-[0.99] disabled:opacity-40"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </main>
  );
}
