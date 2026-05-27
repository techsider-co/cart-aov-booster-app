import {
  BillingInterval,
  BillingReplacementBehavior,
} from "@shopify/shopify-app-react-router/server";

export {
  ANNUAL_PRO_PLAN,
  APP_ROUTES,
  FREE_PLAN_LIMITS,
  MONTHLY_PRO_PLAN,
  PAID_PRO_PLANS,
  PRO_PLAN_FEATURES,
  PRO_PLAN_OPTIONS,
  describeActivePlan,
  getTargetPlan,
  isPaidProPlan,
  type PaidProPlan,
} from "./plans";

import { ANNUAL_PRO_PLAN, MONTHLY_PRO_PLAN } from "./plans";

export const billingConfig = {
  [MONTHLY_PRO_PLAN]: {
    replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
    lineItems: [
      {
        amount: 14.99,
        currencyCode: "USD" as const,
        interval: BillingInterval.Every30Days,
      },
    ],
  },
  [ANNUAL_PRO_PLAN]: {
    replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
    lineItems: [
      {
        amount: 149.9,
        currencyCode: "USD" as const,
        interval: BillingInterval.Annual,
      },
    ],
  },
};

/**
 * Test vs live Billing API charges.
 * Production: set SHOPIFY_BILLING_TEST=false and NODE_ENV=production.
 */
export function isBillingTestMode(): boolean {
  if (process.env.SHOPIFY_BILLING_TEST === "true") {
    return true;
  }
  if (process.env.SHOPIFY_BILLING_TEST === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

/**
 * Simulates checkout when Partner app is Custom / pre-public (Billing API blocked).
 * Set SHOPIFY_BILLING_DEV_BYPASS=false after switching to Public distribution.
 */
export function isBillingDevBypass(): boolean {
  if (process.env.SHOPIFY_BILLING_DEV_BYPASS === "true") {
    return true;
  }
  if (process.env.SHOPIFY_BILLING_DEV_BYPASS === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}
