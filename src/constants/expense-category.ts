export const EXPENSE_CATEGORY = {
  RENT: "RENT",
  UTILITIES: "UTILITIES",
  INTERNET: "INTERNET",
  SUBSCRIPTION: "SUBSCRIPTION",
  FOOD: "FOOD",
  GROCERIES: "GROCERIES",
  TRANSPORT: "TRANSPORT",
  HOUSEHOLD: "HOUSEHOLD",
  HEALTH: "HEALTH",
  SHOPPING: "SHOPPING",
  ENTERTAINMENT: "ENTERTAINMENT",
  OTHER: "OTHER",
} as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORY)[keyof typeof EXPENSE_CATEGORY];

export const EXPENSE_CATEGORY_LABEL_TH: Record<ExpenseCategoryValue, string> = {
  [EXPENSE_CATEGORY.RENT]: "ค่าที่พัก",
  [EXPENSE_CATEGORY.UTILITIES]: "ค่าน้ำไฟ",
  [EXPENSE_CATEGORY.INTERNET]: "ค่าอินเทอร์เน็ต",
  [EXPENSE_CATEGORY.SUBSCRIPTION]: "ค่าสมาชิก/บริการ",
  [EXPENSE_CATEGORY.FOOD]: "ค่ากิน",
  [EXPENSE_CATEGORY.GROCERIES]: "ของใช้เข้าบ้าน",
  [EXPENSE_CATEGORY.TRANSPORT]: "ค่าเดินทาง",
  [EXPENSE_CATEGORY.HOUSEHOLD]: "ของใช้/ซ่อมแซมบ้าน",
  [EXPENSE_CATEGORY.HEALTH]: "ค่ายา/สุขภาพ",
  [EXPENSE_CATEGORY.SHOPPING]: "ของใช้ส่วนตัว",
  [EXPENSE_CATEGORY.ENTERTAINMENT]: "บันเทิง/ท่องเที่ยว",
  [EXPENSE_CATEGORY.OTHER]: "อื่นๆ",
};

// Material Symbols Outlined icon names (see src/components/icon.tsx) — not emoji,
// so rendering stays consistent across platforms instead of following each OS's
// own emoji set.
export const EXPENSE_CATEGORY_ICON: Record<ExpenseCategoryValue, string> = {
  [EXPENSE_CATEGORY.RENT]: "home",
  [EXPENSE_CATEGORY.UTILITIES]: "bolt",
  [EXPENSE_CATEGORY.INTERNET]: "wifi",
  [EXPENSE_CATEGORY.SUBSCRIPTION]: "smart_toy",
  [EXPENSE_CATEGORY.FOOD]: "restaurant",
  [EXPENSE_CATEGORY.GROCERIES]: "shopping_basket",
  [EXPENSE_CATEGORY.TRANSPORT]: "directions_car",
  [EXPENSE_CATEGORY.HOUSEHOLD]: "handyman",
  [EXPENSE_CATEGORY.HEALTH]: "health_and_safety",
  [EXPENSE_CATEGORY.SHOPPING]: "shopping_bag",
  [EXPENSE_CATEGORY.ENTERTAINMENT]: "celebration",
  [EXPENSE_CATEGORY.OTHER]: "receipt_long",
};

// Tailwind classes for this category's chip badge and its slice in the category breakdown bar.
export const EXPENSE_CATEGORY_STYLE: Record<ExpenseCategoryValue, { badge: string; bar: string }> = {
  [EXPENSE_CATEGORY.RENT]: {
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    bar: "bg-violet-500",
  },
  [EXPENSE_CATEGORY.UTILITIES]: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  [EXPENSE_CATEGORY.INTERNET]: {
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    bar: "bg-sky-500",
  },
  [EXPENSE_CATEGORY.SUBSCRIPTION]: {
    badge: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
    bar: "bg-fuchsia-500",
  },
  [EXPENSE_CATEGORY.FOOD]: {
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    bar: "bg-orange-500",
  },
  [EXPENSE_CATEGORY.GROCERIES]: {
    badge: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
    bar: "bg-lime-500",
  },
  [EXPENSE_CATEGORY.TRANSPORT]: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    bar: "bg-blue-500",
  },
  [EXPENSE_CATEGORY.HOUSEHOLD]: {
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    bar: "bg-teal-500",
  },
  [EXPENSE_CATEGORY.HEALTH]: {
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    bar: "bg-rose-500",
  },
  [EXPENSE_CATEGORY.SHOPPING]: {
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    bar: "bg-pink-500",
  },
  [EXPENSE_CATEGORY.ENTERTAINMENT]: {
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    bar: "bg-indigo-500",
  },
  [EXPENSE_CATEGORY.OTHER]: {
    badge: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    bar: "bg-neutral-400",
  },
};

export const EXPENSE_SOURCE = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
} as const;

export type ExpenseSourceValue = (typeof EXPENSE_SOURCE)[keyof typeof EXPENSE_SOURCE];
