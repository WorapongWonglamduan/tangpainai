"use client";

import { useState } from "react";

type CalendarDatePickerProps = {
  value: string; // "YYYY-MM-DD"
  onChange: (date: string) => void;
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

export function CalendarDatePicker({ value, onChange }: CalendarDatePickerProps) {
  const selected = parseDateParts(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.y);
  const [viewMonth, setViewMonth] = useState(selected.m);

  function openCalendar() {
    setViewYear(selected.y);
    setViewMonth(selected.m);
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

  function selectDay(day: number) {
    onChange(formatDateString(viewYear, viewMonth, day));
    setOpen(false);
  }

  function goToToday() {
    const now = new Date();
    onChange(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
    setOpen(false);
  }

  const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
  const isoWeekday = firstOfMonth.getUTCDay() === 0 ? 7 : firstOfMonth.getUTCDay(); // 1=Mon..7=Sun
  const leadingBlanks = isoWeekday - 1;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const cells: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openCalendar())}
        className="flex w-full items-center gap-2 rounded-xl bg-surface-container-lowest px-3 py-2 text-sm shadow-sm"
      >
        <span className="text-on-surface-variant">📅</span>
        <span className="font-medium">{formatShortThai(value)}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-50 mt-2 rounded-xl bg-surface-container-lowest p-3 shadow-lg">
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="rounded-full px-2 py-1 text-on-surface-variant hover:bg-surface-container-low"
              >
                ‹
              </button>
              <span className="text-sm font-semibold">
                {MONTH_LABELS_TH[viewMonth - 1]} {viewYear + BUDDHIST_ERA_OFFSET}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="rounded-full px-2 py-1 text-on-surface-variant hover:bg-surface-container-low"
              >
                ›
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-on-surface-variant">
              {WEEKDAY_LABELS_TH.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((day, index) => {
                if (day === null) {
                  return <span key={`blank-${index}`} />;
                }

                const dateStr = formatDateString(viewYear, viewMonth, day);
                const isSelected = dateStr === value;
                const isToday = dateStr === todayStr;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`aspect-square rounded-full text-sm transition-colors ${
                      isSelected
                        ? "bg-primary font-semibold text-on-primary"
                        : isToday
                          ? "bg-surface-container font-medium text-primary"
                          : "text-on-surface hover:bg-surface-container-low"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={goToToday}
              className="mt-2 w-full rounded-lg py-1.5 text-center text-sm font-medium text-primary hover:bg-surface-container-low"
            >
              วันนี้
            </button>
          </div>
        </>
      )}
    </div>
  );
}
