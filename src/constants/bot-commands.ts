export const CANCEL_COMMANDS = ["ยกเลิก", "ยกเลิกรายการล่าสุด", "ลบรายการล่าสุด"] as const;

// Matches "ยกเลิก 1", "ยกเลิก 1 3", "ยกเลิก 1,3" — cancel by index shown in the ประวัติ list.
export const CANCEL_BY_INDEX_PATTERN = /^ยกเลิก[\s,]+([\d\s,]+)$/;

export const HISTORY_COMMANDS = ["ประวัติ", "ดูประวัติ", "ประวัติรายการ"] as const;

export const HISTORY_LIST_SIZE = 10;

// Postback data sent by the rich menu's "วิธีใช้งาน" tile.
export const RICH_MENU_POSTBACK = {
  USAGE_GUIDE: "richmenu:usage_guide",
} as const;

// Postback data for the cancel confirmation step (typed "ยกเลิก" / "ยกเลิก N"
// no longer delete immediately — they preview, then wait for this postback).
// Separate prefix from the pending-expense "confirm:"/"reject:" postbacks
// used right after saving, so the two confirm flows can never collide.
export const CANCEL_CONFIRM_PREFIX = "cancel_confirm:";
export const CANCEL_REJECT = "cancel_reject";
