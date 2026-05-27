import { createCookie } from "react-router";

import { type PaidProPlan, isPaidProPlan } from "../billing/plans";
import {
  isBillingDevBypass,
  isBillingTestMode,
} from "../billing/plans.server";
import prisma from "../db.server";

const DEV_BILLING_COOKIE = createCookie("aov_booster_dev_plan", {
  httpOnly: true,
  sameSite: "none",
  secure: true,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
});

export function isBillingApiUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  const errorData =
    "errorData" in error && Array.isArray(error.errorData)
      ? error.errorData
      : [];

  const apiMessages = errorData
    .map((entry) =>
      entry &&
      typeof entry === "object" &&
      "message" in entry &&
      typeof entry.message === "string"
        ? entry.message
        : "",
    )
    .join(" ");

  const combined = `${message} ${apiMessages}`.toLowerCase();

  return (
    combined.includes("public distribution") ||
    combined.includes("custom apps cannot use") ||
    combined.includes("cannot use the billing api")
  );
}

export class BillingConfigurationError extends Error {
  constructor() {
    super(
      "Billing API requires Public app distribution. Use SHOPIFY_BILLING_DEV_BYPASS=true for local simulation, or set Public (draft OK) in Partner Dashboard.",
    );
    this.name = "BillingConfigurationError";
  }
}

async function getDevBillingPlanFromDb(
  shop: string,
): Promise<PaidProPlan | null> {
  const record = await prisma.shopProSubscription.findUnique({
    where: { shop },
  });

  if (record && isPaidProPlan(record.plan)) {
    return record.plan;
  }

  return null;
}

export async function getDevBillingPlan(
  request: Request,
  shop: string,
): Promise<PaidProPlan | null> {
  if (!isBillingDevBypass()) {
    return null;
  }

  const fromDb = await getDevBillingPlanFromDb(shop);
  if (fromDb) {
    return fromDb;
  }

  const fromCookie = await DEV_BILLING_COOKIE.parse(
    request.headers.get("Cookie"),
  );

  if (typeof fromCookie === "string" && isPaidProPlan(fromCookie)) {
    await persistDevBillingPlan(shop, fromCookie);
    return fromCookie;
  }

  return null;
}

export async function persistDevBillingPlan(
  shop: string,
  plan: PaidProPlan,
): Promise<void> {
  await prisma.shopProSubscription.upsert({
    where: { shop },
    create: {
      shop,
      plan,
      isTest: isBillingTestMode(),
    },
    update: {
      plan,
      isTest: isBillingTestMode(),
    },
  });
}

export async function setDevBillingPlan(
  shop: string,
  plan: PaidProPlan,
): Promise<string> {
  await persistDevBillingPlan(shop, plan);
  return DEV_BILLING_COOKIE.serialize(plan);
}

export async function clearDevBillingPlan(shop: string): Promise<string> {
  await prisma.shopProSubscription.deleteMany({ where: { shop } });
  return DEV_BILLING_COOKIE.serialize("", { maxAge: 0 });
}

export function mockDevSubscription(plan: PaidProPlan) {
  return {
    id: "dev-bypass",
    name: plan,
    test: isBillingTestMode(),
    status: "ACTIVE",
  };
}
