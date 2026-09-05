export const DASHBOARD_PERIOD = {
  DAY: "DAY",
  WEEK: "WEEK",
  BIWEEKLY: "BIWEEKLY",
  MONTH: "MONTH",
} as const;

export type DashboardPeriodValue = (typeof DASHBOARD_PERIOD)[keyof typeof DASHBOARD_PERIOD];

export const DASHBOARD_PERIOD_LABEL_TH: Record<DashboardPeriodValue, string> = {
  [DASHBOARD_PERIOD.DAY]: "รายวัน",
  [DASHBOARD_PERIOD.WEEK]: "รายสัปดาห์",
  [DASHBOARD_PERIOD.BIWEEKLY]: "ราย 2 สัปดาห์",
  [DASHBOARD_PERIOD.MONTH]: "รายเดือน",
};

export const DASHBOARD_PERIOD_OPTIONS: DashboardPeriodValue[] = [
  DASHBOARD_PERIOD.DAY,
  DASHBOARD_PERIOD.WEEK,
  DASHBOARD_PERIOD.BIWEEKLY,
  DASHBOARD_PERIOD.MONTH,
];
