/** Shopify billing plan keys — must match `billing/plans.server.ts` → `billingConfig` */
export const MONTHLY_PRO_PLAN = "Pro Plan - Monthly";
export const ANNUAL_PRO_PLAN = "Pro Plan - Annual";

export const PAID_PRO_PLANS = [MONTHLY_PRO_PLAN, ANNUAL_PRO_PLAN] as const;

export type PaidProPlan = (typeof PAID_PRO_PLANS)[number];

/** Free tier: no paid subscription (`isPro === false`) */
export const FREE_PLAN_LIMITS = {
  shippingBar: false,
  stickyCart: false,
} as const;

export const PRO_PLAN_FEATURES = {
  shippingBar: true,
  stickyCart: true,
} as const;

export const PRO_PLAN_OPTIONS = [
  {
    id: MONTHLY_PRO_PLAN,
    name: "AOV Booster Pro",
    intervalLabel: "Aylık",
    priceLabel: "$14.99",
    priceAmount: 14.99,
    description: "Shipping Bar ve Sticky Cart — aylık faturalandırma.",
  },
  {
    id: ANNUAL_PRO_PLAN,
    name: "AOV Booster Pro",
    intervalLabel: "Yıllık",
    priceLabel: "$149.90",
    priceAmount: 149.9,
    description: "Her iki widget — yıllık faturalandırma (~%17 tasarruf).",
  },
] as const;

export const APP_ROUTES = {
  billing: "/app/billing",
  home: "/app",
} as const;

export function isPaidProPlan(value: string): value is PaidProPlan {
  return (PAID_PRO_PLANS as readonly string[]).includes(value);
}

export function getTargetPlan(current: PaidProPlan | null): PaidProPlan {
  return current === ANNUAL_PRO_PLAN ? MONTHLY_PRO_PLAN : ANNUAL_PRO_PLAN;
}

export function describeActivePlan(plan: PaidProPlan | null): string {
  if (plan === MONTHLY_PRO_PLAN) {
    return "AOV Booster Pro (Aylık)";
  }
  if (plan === ANNUAL_PRO_PLAN) {
    return "AOV Booster Pro (Yıllık)";
  }
  return "Free";
}
