export const CANCEL_COMMANDS = ["ยกเลิก", "ยกเลิกรายการล่าสุด", "ลบรายการล่าสุด"] as const;

// Matches "ยกเลิก 1", "ยกเลิก 1 3", "ยกเลิก 1,3" — cancel by index shown in the ประวัติ list.
export const CANCEL_BY_INDEX_PATTERN = /^ยกเลิก[\s,]+([\d\s,]+)$/;

export const HISTORY_COMMANDS = ["ประวัติ", "ดูประวัติ", "ประวัติรายการ"] as const;

export const HISTORY_LIST_SIZE = 10;
