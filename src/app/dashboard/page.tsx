"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  EXPENSE_CATEGORY,
  EXPENSE_CATEGORY_ICON,
  EXPENSE_CATEGORY_LABEL_TH,
  EXPENSE_CATEGORY_STYLE,
  type ExpenseCategoryValue,
} from "@/constants/expense-category";
import {
  DASHBOARD_PERIOD,
  DASHBOARD_PERIOD_LABEL_TH,
  DASHBOARD_PERIOD_OPTIONS,
  type DashboardPeriodValue,
} from "@/constants/period";
import { useLiffIdToken } from "@/hooks/use-liff-id-token";
import { CenteredMessage } from "@/components/centered-message";
import { CalendarDatePicker } from "@/components/calendar-date-picker";
import { Icon } from "@/components/icon";

type DashboardExpense = {
  id: string;
  category: ExpenseCategoryValue;
  amount: string;
  note: string | null;
  payerName: string;
  createdAt: string;
};

type DashboardResponse = {
  memberName: string;
  period: DashboardPeriodValue;
  anchorDate: string;
  periodLabel: string;
  hasPrevPeriod: boolean;
  hasNextPeriod: boolean;
  prevAnchorDate: string;
  nextAnchorDate: string;
  customStart: string | null;
  customEnd: string | null;
  selectedCategories: ExpenseCategoryValue[];
  total: number;
  categoryTotals: Record<ExpenseCategoryValue, number>;
  lifetimeTotal: number;
  expenses: DashboardExpense[];
};

const DEFAULT_PERIOD = DASHBOARD_PERIOD.MONTH;
const ALL_CATEGORIES = Object.values(EXPENSE_CATEGORY);

export default function DashboardPage() {
  const { idToken, error: initError, reauthenticate } = useLiffIdToken();
  const [period, setPeriod] = useState<DashboardPeriodValue>(DEFAULT_PERIOD);
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const [customStart, setCustomStart] = useState<string | null>(null);
  const [customEnd, setCustomEnd] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [draftEnd, setDraftEnd] = useState<string | null>(null);
  // Empty array means "no filter" — every category is included.
  const [selectedCategories, setSelectedCategories] = useState<ExpenseCategoryValue[]>([]);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;

    async function load() {
      setFetchError(null);
      setIsLoading(true);

      try {
        const params = new URLSearchParams({ period });
        if (period === DASHBOARD_PERIOD.CUSTOM) {
          if (customStart) params.set("start", customStart);
          if (customEnd) params.set("end", customEnd);
        } else if (anchorDate) {
          params.set("date", anchorDate);
        }
        for (const category of selectedCategories) {
          params.append("category", category);
        }

        const response = await fetch(`/api/dashboard/summary?${params}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (cancelled) return;

        if (response.status === 401) {
          // The ID token was rejected server-side despite passing our
          // client-side expiry check (e.g. it expired in the gap between
          // that check and this request). Retrying with the same idToken
          // would just repeat the same 401 forever, so force a fresh LINE
          // login instead of showing a "try again" that can't succeed.
          setData(null);
          setFetchError("เซสชันหมดอายุ กำลังเข้าสู่ระบบใหม่...");
          reauthenticate();
          return;
        }

        if (response.status === 404) {
          setData(null);
          setFetchError("บัญชีนี้ยังไม่ได้เข้าร่วมบ้าน กรุณาเริ่มใช้งานผ่านแชทบอทก่อน");
          return;
        }

        if (!response.ok) {
          setData(null);
          setFetchError("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
          return;
        }

        const json = (await response.json()) as DashboardResponse;
        setData(json);

        if (json.period === DASHBOARD_PERIOD.CUSTOM) {
          setDraftStart(json.customStart);
          setDraftEnd(json.customEnd);
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setFetchError("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [idToken, period, anchorDate, customStart, customEnd, selectedCategories, retryCount, reauthenticate]);

  function selectPeriod(next: DashboardPeriodValue) {
    if (next === period) return;

    setPeriod(next);
    setAnchorDate(null);
    setCustomStart(null);
    setCustomEnd(null);
    setDraftStart(null);
    setDraftEnd(null);
  }

  function applyCustomRange() {
    if (!draftStart || !draftEnd) return;
    setCustomStart(draftStart);
    setCustomEnd(draftEnd);
  }

  function toggleCategory(category: ExpenseCategoryValue) {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((value) => value !== category) : [...current, category],
    );
  }

  function clearCategoryFilter() {
    setSelectedCategories([]);
  }

  if (initError) {
    return <CenteredMessage text={initError} />;
  }

  if (!data) {
    if (fetchError) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
            <Icon name="cloud_off" className="text-[24px]" />
          </span>
          <p className="mt-3 max-w-xs text-sm text-on-surface-variant">{fetchError}</p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-4 min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary transition-transform active:scale-95"
          >
            ลองอีกครั้ง
          </button>
        </main>
      );
    }

    return <CenteredMessage text="กำลังโหลดสรุปค่าใช้จ่าย..." />;
  }

  const categoryEntries = (Object.entries(data.categoryTotals) as [ExpenseCategoryValue, number][])
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a);
  const customRangeChanged = Boolean(
    draftStart &&
      draftEnd &&
      (draftStart !== data.customStart || draftEnd !== data.customEnd),
  );
  const datePickerMode = period === DASHBOARD_PERIOD.MONTH ? "month" : "day";

  return (
    <main
      className="mx-auto min-h-screen w-full max-w-md bg-surface px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-on-surface"
      aria-busy={isLoading}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image src="/logo.png" alt="ตังค์ไปไหน" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" priority />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-primary">ภาพรวมของบ้าน</p>
            <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight">สรุปค่าใช้จ่าย</h1>
          </div>
        </div>
        <span className="flex min-w-0 max-w-[52%] items-center gap-2 rounded-full border border-outline-variant/60 bg-surface-container-lowest py-1.5 pr-3 pl-1.5 text-xs font-medium text-on-surface-variant shadow-sm">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container text-[11px] font-bold text-on-primary-container">
            {data.memberName.charAt(0)}
          </span>
          <span className="truncate">{data.memberName}</span>
        </span>
      </header>

      <section className="mt-5 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-3 shadow-sm" aria-label="ตัวกรองช่วงเวลา">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
              <Icon name="tune" className="text-[17px]" />
            </span>
            <h2 className="text-sm font-semibold">เลือกช่วงเวลา</h2>
          </div>
          <span className={`flex items-center gap-1 text-[11px] text-primary transition-opacity ${isLoading ? "opacity-100" : "opacity-0"}`} aria-live="polite">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            กำลังอัปเดต
          </span>
        </div>

        <div className="grid grid-cols-6 gap-1.5 rounded-xl bg-surface-container-low p-1.5" role="group" aria-label="รูปแบบช่วงเวลา">
          {DASHBOARD_PERIOD_OPTIONS.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => selectPeriod(option)}
              aria-pressed={option === period}
              className={`${index < 3 ? "col-span-2" : "col-span-3"} min-h-10 rounded-lg px-2 text-xs font-medium transition-all active:scale-[0.97] sm:text-sm ${
                option === period
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-lowest"
              }`}
            >
              {DASHBOARD_PERIOD_LABEL_TH[option]}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-medium text-on-surface-variant">กรองตามหมวด</span>
            {selectedCategories.length > 0 && (
              <button
                type="button"
                onClick={clearCategoryFilter}
                disabled={isLoading}
                className="text-[11px] font-semibold text-primary disabled:opacity-50"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="กรองตามหมวด">
            {ALL_CATEGORIES.map((category) => {
              const isSelected = selectedCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  disabled={isLoading}
                  aria-pressed={isSelected}
                  className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors active:scale-95 disabled:opacity-50 ${
                    isSelected
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant/70 bg-surface-container-lowest text-on-surface-variant hover:border-primary/50"
                  }`}
                >
                  <Icon name={EXPENSE_CATEGORY_ICON[category]} className="text-[15px]" />
                  {EXPENSE_CATEGORY_LABEL_TH[category]}
                </button>
              );
            })}
          </div>
        </div>

        {period === DASHBOARD_PERIOD.CUSTOM ? (
          <div className="mt-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] font-medium text-on-surface-variant">วันเริ่มต้น</span>
                <CalendarDatePicker
                  value={draftStart ?? data.customStart ?? data.anchorDate}
                  onChange={setDraftStart}
                  disabled={isLoading}
                  ariaLabel="เลือกวันเริ่มต้น"
                  className="flex min-h-11 w-full items-center gap-1.5 rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-2.5 text-left text-xs transition-colors hover:border-primary disabled:opacity-50"
                />
              </label>
              <span className="mb-3 text-xs text-on-surface-variant">ถึง</span>
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] font-medium text-on-surface-variant">วันสิ้นสุด</span>
                <CalendarDatePicker
                  value={draftEnd ?? data.customEnd ?? data.anchorDate}
                  onChange={setDraftEnd}
                  disabled={isLoading}
                  ariaLabel="เลือกวันสิ้นสุด"
                  align="right"
                  className="flex min-h-11 w-full items-center gap-1.5 rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-2.5 text-left text-xs transition-colors hover:border-primary disabled:opacity-50"
                />
              </label>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <p className="text-[10px] text-on-surface-variant">เลือกได้สูงสุด 366 วัน</p>
              <button
                type="button"
                disabled={!customRangeChanged || isLoading}
                onClick={applyCustomRange}
                className="min-h-10 rounded-xl bg-primary px-5 text-xs font-semibold text-on-primary transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
              >
                ใช้ช่วงเวลานี้
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1 rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-1.5">
            <button
              type="button"
              aria-label="ช่วงเวลาก่อนหน้า"
              disabled={!data.hasPrevPeriod || isLoading}
              onClick={() => setAnchorDate(data.prevAnchorDate)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-25"
            >
              <Icon name="chevron_left" />
            </button>
            <CalendarDatePicker
              value={data.anchorDate}
              onChange={setAnchorDate}
              label={data.periodLabel}
              mode={datePickerMode}
              disabled={isLoading}
              ariaLabel={datePickerMode === "month" ? "เลือกเดือน" : "เลือกวันที่"}
              className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition-colors hover:bg-surface-container-low disabled:opacity-50"
            />
            <button
              type="button"
              aria-label="ช่วงเวลาถัดไป"
              disabled={!data.hasNextPeriod || isLoading}
              onClick={() => setAnchorDate(data.nextAnchorDate)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-25"
            >
              <Icon name="chevron_right" />
            </button>
          </div>
        )}
      </section>

      {fetchError && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
          <Icon name="error" className="text-[18px]" />
          <span className="flex-1">{fetchError}</span>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="font-semibold underline underline-offset-2">
            ลองใหม่
          </button>
        </div>
      )}

      <div className={`transition-opacity duration-200 ${isLoading ? "opacity-55" : "opacity-100"}`}>
        <section className="relative mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-emerald-700 p-5 text-on-primary shadow-md shadow-primary/15">
          <span className="absolute -top-8 -right-5 h-28 w-28 rounded-full bg-white/10" />
          <span className="absolute -right-2 -bottom-10 h-24 w-24 rounded-full bg-black/5" />
          <div className="relative">
            <div className="flex items-center gap-1.5 text-xs font-medium text-on-primary/80">
              <Icon name="payments" className="text-[16px]" />
              ยอดรวมช่วงนี้
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight">
              <span className="mr-1 text-xl font-semibold opacity-80">฿</span>
              {data.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-on-primary/75">{data.periodLabel}</p>
          </div>
        </section>

        <section className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-3.5 shadow-sm">
          <span className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
              <Icon name="account_balance_wallet" className="text-[17px]" />
            </span>
            ใช้ไปทั้งหมดตั้งแต่เริ่มใช้งาน
          </span>
          <span className="shrink-0 text-base font-bold">฿{data.lifetimeTotal.toLocaleString("th-TH")}</span>
        </section>

        {categoryEntries.length > 0 && (
          <section className="mt-4 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">สัดส่วนตามหมวด</h2>
              <span className="text-[11px] text-on-surface-variant">{categoryEntries.length} หมวด</span>
            </div>

            <div className="mt-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-container-high" aria-label="สัดส่วนค่าใช้จ่ายตามหมวด">
              {categoryEntries.map(([category, amount]) => (
                <div
                  key={category}
                  className={EXPENSE_CATEGORY_STYLE[category].bar}
                  style={{ width: `${(amount / data.total) * 100}%` }}
                  title={`${EXPENSE_CATEGORY_LABEL_TH[category]} ${((amount / data.total) * 100).toFixed(0)}%`}
                />
              ))}
            </div>

            <ul className="mt-3 divide-y divide-outline-variant/50">
              {categoryEntries.map(([category, amount]) => (
                <li key={category} className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-0">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${EXPENSE_CATEGORY_STYLE[category].badge}`}>
                      <Icon name={EXPENSE_CATEGORY_ICON[category]} className="text-[17px]" />
                    </span>
                    <span className="truncate">{EXPENSE_CATEGORY_LABEL_TH[category]}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold">฿{amount.toLocaleString("th-TH")}</span>
                    <span className="block text-[10px] text-on-surface-variant">{((amount / data.total) * 100).toFixed(0)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-5">
          <div className="flex items-end justify-between px-1">
            <div>
              <h2 className="text-sm font-semibold">รายการค่าใช้จ่าย</h2>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">เรียงจากรายการล่าสุด</p>
            </div>
            <span className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-medium text-on-surface-variant">
              {data.expenses.length} รายการ
            </span>
          </div>

          {data.expenses.length === 0 ? (
            <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                <Icon name="receipt_long" className="text-[24px]" />
              </span>
              <p className="mt-3 text-sm font-medium">ยังไม่มีค่าใช้จ่ายในช่วงนี้</p>
              <p className="mt-1 text-xs text-on-surface-variant">ลองเปลี่ยนช่วงเวลาเพื่อดูรายการอื่น</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {data.expenses.map((expense) => (
                <li key={expense.id}>
                  <Link
                    href={`/dashboard/expense/${expense.id}`}
                    className="group flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-3 shadow-sm transition-all hover:border-primary/30 active:scale-[0.99] active:bg-surface-container-low"
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${EXPENSE_CATEGORY_STYLE[expense.category].badge}`}>
                      <Icon name={EXPENSE_CATEGORY_ICON[expense.category]} className="text-[21px]" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {expense.note || EXPENSE_CATEGORY_LABEL_TH[expense.category]}
                        </span>
                        <span className="shrink-0 text-sm font-bold">฿{Number(expense.amount).toLocaleString("th-TH")}</span>
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-on-surface-variant">
                        <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${EXPENSE_CATEGORY_STYLE[expense.category].badge}`}>
                          {EXPENSE_CATEGORY_LABEL_TH[expense.category]}
                        </span>
                        <span className="truncate">{expense.payerName}</span>
                        <span className="shrink-0">· {new Date(expense.createdAt).toLocaleString("th-TH", {
                          timeZone: "Asia/Bangkok",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}</span>
                      </div>
                    </div>

                    <Icon name="chevron_right" className="text-[18px] text-on-surface-variant/50 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
