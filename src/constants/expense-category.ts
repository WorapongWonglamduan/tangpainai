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

export const EXPENSE_SOURCE = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
} as const;

export type ExpenseSourceValue = (typeof EXPENSE_SOURCE)[keyof typeof EXPENSE_SOURCE];
