export const EXPENSE_CATEGORY = {
  RENT: "RENT",
  UTILITIES: "UTILITIES",
  INTERNET: "INTERNET",
  AI: "AI",
  FOOD: "FOOD",
  OTHER: "OTHER",
} as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORY)[keyof typeof EXPENSE_CATEGORY];

export const EXPENSE_CATEGORY_LABEL_TH: Record<ExpenseCategoryValue, string> = {
  [EXPENSE_CATEGORY.RENT]: "ค่าที่พัก",
  [EXPENSE_CATEGORY.UTILITIES]: "ค่าน้ำไฟ",
  [EXPENSE_CATEGORY.INTERNET]: "ค่าอินเทอร์เน็ต",
  [EXPENSE_CATEGORY.AI]: "ค่าใช้จ่าย AI",
  [EXPENSE_CATEGORY.FOOD]: "ค่ากิน",
  [EXPENSE_CATEGORY.OTHER]: "อื่นๆ",
};

export const EXPENSE_CATEGORY_ICON: Record<ExpenseCategoryValue, string> = {
  [EXPENSE_CATEGORY.RENT]: "🏠",
  [EXPENSE_CATEGORY.UTILITIES]: "💡",
  [EXPENSE_CATEGORY.INTERNET]: "🌐",
  [EXPENSE_CATEGORY.AI]: "🤖",
  [EXPENSE_CATEGORY.FOOD]: "🍜",
  [EXPENSE_CATEGORY.OTHER]: "🧾",
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
  [EXPENSE_CATEGORY.AI]: {
    badge: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
    bar: "bg-fuchsia-500",
  },
  [EXPENSE_CATEGORY.FOOD]: {
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    bar: "bg-orange-500",
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
