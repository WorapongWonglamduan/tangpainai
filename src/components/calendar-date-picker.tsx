"use client";

import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/icon";

type CalendarDatePickerProps = {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  className?: string;
  mode?: "day" | "month";
  disabled?: boolean;
  ariaLabel?: string;
};

const WEEKDAY_LABELS_TH = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const MONTH_LABELS_TH = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const BUDDHIST_ERA_OFFSET = 543;

function parseDateParts(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

function formatDateString(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatShortThai(dateStr: string): string {
  const { y, m, d } = parseDateParts(dateStr);
  return `${d} ${MONTH_LABELS_TH[m - 1].slice(0, 3)}. ${y + BUDDHIST_ERA_OFFSET}`;
}

function getBangkokToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function CalendarDatePicker({
  value,
  onChange,
  label,
  className,
  mode = "day",
  disabled = false,
  ariaLabel,
}: CalendarDatePickerProps) {
  const selected = parseDateParts(value);
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.y);
  const [viewMonth, setViewMonth] = useState(selected.m);
  // What's highlighted while the dialog is open but not yet committed —
  // only flows into onChange when the user taps "ตกลง". This is what makes
  // the calendar a real pick-then-confirm dialog instead of closing (and
  // silently applying a value) on the first tap.
  const [draftDate, setDraftDate] = useState(value);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function openCalendar() {
    setViewYear(selected.y);
    setViewMonth(selected.m);
    setDraftDate(value);
    setOpen(true);
  }

  function shiftMonth(delta: number) {
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
  }

  function pickDay(day: number) {
    setDraftDate(formatDateString(viewYear, viewMonth, day));
  }

  function pickMonth(month: number) {
    setViewMonth(month);
    setDraftDate(formatDateString(viewYear, month, 1));
  }

  function jumpToCurrentPeriod() {
    const today = getBangkokToday();
    const { y, m } = parseDateParts(today);
    setViewYear(y);
    setViewMonth(m);
    setDraftDate(mode === "month" ? formatDateString(y, m, 1) : today);
  }

  function confirm() {
    onChange(draftDate);
    setOpen(false);
  }

  const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
  const isoWeekday = firstOfMonth.getUTCDay() === 0 ? 7 : firstOfMonth.getUTCDay();
  const leadingBlanks = isoWeekday - 1;
  const todayStr = getBangkokToday();
  const today = parseDateParts(todayStr);
  const draftParts = parseDateParts(draftDate);
  const cells: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={openCalendar}
        className={
          className ??
          "flex min-h-11 w-full items-center gap-2 rounded-xl bg-surface-container-lowest px-3 text-sm shadow-sm disabled:opacity-50"
        }
      >
        <Icon name={mode === "month" ? "calendar_view_month" : "calendar_month"} className="shrink-0 text-[18px] text-primary" />
        <span className="truncate font-medium">{label ?? formatShortThai(value)}</span>
        <Icon name="arrow_drop_down" className="ml-auto shrink-0 text-[18px] text-on-surface-variant" />
      </button>

      {open && (
        <>
          {/* Fixed positioning (not absolute-relative-to-trigger) so this
              dialog always renders centered over the whole viewport and is
              never clipped by a scrollable ancestor like the filter sheet. */}
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-label={mode === "month" ? "เลือกเดือน" : "เลือกวันที่"}
            className="fixed inset-x-4 top-1/2 z-[70] mx-auto w-auto max-w-80 -translate-y-1/2 rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-3 shadow-xl"
          >
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                aria-label={mode === "month" ? "ปีก่อนหน้า" : "เดือนก่อนหน้า"}
                onClick={() => (mode === "month" ? setViewYear((year) => year - 1) : shiftMonth(-1))}
                className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                <Icon name="chevron_left" />
              </button>
              <span className="text-sm font-semibold">
                {mode === "day" && `${MONTH_LABELS_TH[viewMonth - 1]} `}
                {viewYear + BUDDHIST_ERA_OFFSET}
              </span>
              <button
                type="button"
                aria-label={mode === "month" ? "ปีถัดไป" : "เดือนถัดไป"}
                onClick={() => (mode === "month" ? setViewYear((year) => year + 1) : shiftMonth(1))}
                className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                <Icon name="chevron_right" />
              </button>
            </div>

            {mode === "month" ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {MONTH_LABELS_TH.map((monthLabel, index) => {
                  const month = index + 1;
                  const isSelected = draftParts.y === viewYear && draftParts.m === month;
                  const isCurrent = today.y === viewYear && today.m === month;

                  return (
                    <button
                      key={monthLabel}
                      type="button"
                      onClick={() => pickMonth(month)}
                      aria-pressed={isSelected}
                      className={`min-h-11 rounded-xl px-1 text-xs transition-colors ${
                        isSelected
                          ? "bg-primary font-semibold text-on-primary"
                          : isCurrent
                            ? "bg-primary-container font-semibold text-on-primary-container"
                            : "text-on-surface hover:bg-surface-container-low"
                      }`}
                    >
                      {monthLabel.slice(0, 3)}.
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-on-surface-variant">
                  {WEEKDAY_LABELS_TH.map((weekday) => (
                    <span key={weekday} className="py-1">{weekday}</span>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                  {cells.map((day, index) => {
                    if (day === null) return <span key={`blank-${index}`} />;

                    const dateStr = formatDateString(viewYear, viewMonth, day);
                    const isSelected = dateStr === draftDate;
                    const isToday = dateStr === todayStr;

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => pickDay(day)}
                        aria-label={`${day} ${MONTH_LABELS_TH[viewMonth - 1]} ${viewYear + BUDDHIST_ERA_OFFSET}`}
                        aria-current={isToday ? "date" : undefined}
                        aria-pressed={isSelected}
                        className={`aspect-square rounded-full text-sm transition-colors ${
                          isSelected
                            ? "bg-primary font-semibold text-on-primary"
                            : isToday
                              ? "bg-primary-container font-medium text-on-primary-container"
                              : "text-on-surface hover:bg-surface-container-low"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={jumpToCurrentPeriod}
                className="min-h-10 flex-1 rounded-xl text-center text-sm font-semibold text-primary transition-colors hover:bg-surface-container-low"
              >
                {mode === "month" ? "เดือนนี้" : "วันนี้"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-10 flex-1 rounded-xl text-center text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirm}
                className="min-h-10 flex-1 rounded-xl bg-primary text-center text-sm font-semibold text-on-primary transition-transform active:scale-[0.97]"
              >
                ตกลง
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
