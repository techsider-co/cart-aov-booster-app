import {
  ANNUAL_PRO_PLAN,
  MONTHLY_PRO_PLAN,
  type PaidProPlan,
  isPaidProPlan,
} from "../billing/plans";
import {
  isBillingDevBypass,
  isBillingTestMode,
} from "../billing/plans.server";
import {
  BillingConfigurationError,
  clearDevBillingPlan,
  getDevBillingPlan,
  isBillingApiUnavailableError,
  mockDevSubscription,
} from "./billing-dev.server";
import type { authenticate } from "../shopify.server";

type AdminBilling = Awaited<
  ReturnType<typeof authenticate.admin>
>["billing"];

export type SubscriptionInfo = {
  isPro: boolean;
  activePlan: PaidProPlan | null;
  appSubscriptions: Array<{
    id: string;
    name: string;
    test: boolean;
    status: string;
  }>;
  isDevBypass: boolean;
};

function resolveActivePlan(
  subscriptionName: string | undefined,
): PaidProPlan | null {
  if (subscriptionName && isPaidProPlan(subscriptionName)) {
    return subscriptionName;
  }

  if (!subscriptionName) {
    return null;
  }

  const normalized = subscriptionName.toLowerCase();

  if (normalized.includes("annual") || normalized.includes("yıllık")) {
    return ANNUAL_PRO_PLAN;
  }

  if (
    normalized.includes("monthly") ||
    normalized.includes("aylık") ||
    normalized.includes("pro")
  ) {
    return MONTHLY_PRO_PLAN;
  }

  return null;
}

async function checkBillingApi(
  billing: AdminBilling,
): Promise<SubscriptionInfo> {
  const isTest = isBillingTestMode();

  const scoped = await billing.check({
    plans: [MONTHLY_PRO_PLAN, ANNUAL_PRO_PLAN],
    isTest,
  });

  if (scoped.hasActivePayment) {
    const first = scoped.appSubscriptions[0];
    return {
      isPro: true,
      activePlan: resolveActivePlan(first?.name) ?? MONTHLY_PRO_PLAN,
      appSubscriptions: scoped.appSubscriptions.map((sub) => ({
        id: sub.id,
        name: sub.name,
        test: sub.test,
        status: sub.status,
      })),
      isDevBypass: false,
    };
  }

  const anyActive = await billing.check({ isTest });

  if (anyActive.hasActivePayment && anyActive.appSubscriptions.length > 0) {
    const first = anyActive.appSubscriptions[0];
    const activePlan = resolveActivePlan(first?.name);

    if (activePlan) {
      return {
        isPro: true,
        activePlan,
        appSubscriptions: anyActive.appSubscriptions.map((sub) => ({
          id: sub.id,
          name: sub.name,
          test: sub.test,
          status: sub.status,
        })),
        isDevBypass: false,
      };
    }
  }

  return {
    isPro: false,
    activePlan: null,
    appSubscriptions: [],
    isDevBypass: false,
  };
}

export async function getSubscriptionInfo(
  request: Request,
  billing: AdminBilling,
  shop: string,
): Promise<SubscriptionInfo> {
  if (isBillingDevBypass()) {
    const devPlan = await getDevBillingPlan(request, shop);

    if (devPlan) {
      const mock = mockDevSubscription(devPlan);
      return {
        isPro: true,
        activePlan: devPlan,
        appSubscriptions: [mock],
        isDevBypass: true,
      };
    }

    return {
      isPro: false,
      activePlan: null,
      appSubscriptions: [],
      isDevBypass: true,
    };
  }

  try {
    return await checkBillingApi(billing);
  } catch (error) {
    if (isBillingApiUnavailableError(error)) {
      throw new BillingConfigurationError();
    }
    throw error;
  }
}

export async function checkProSubscription(
  request: Request,
  billing: AdminBilling,
  shop: string,
): Promise<{ isPro: boolean; info: SubscriptionInfo }> {
  const info = await getSubscriptionInfo(request, billing, shop);
  return { isPro: info.isPro, info };
}

export async function requestPaidSubscription(
  request: Request,
  billing: AdminBilling,
  shop: string,
  plan: PaidProPlan,
) {
  if (isBillingDevBypass()) {
    const { redirect } = await import("react-router");
    const { APP_ROUTES } = await import("../billing/plans");
    const { setDevBillingPlan } = await import("./billing-dev.server");

    return redirect(`${APP_ROUTES.billing}?success=subscribed`, {
      headers: {
        "Set-Cookie": await setDevBillingPlan(shop, plan),
      },
    });
  }

  const { getBillingReturnUrl } = await import("../billing/return-url.server");

  try {
    return billing.request({
      plan,
      isTest: isBillingTestMode(),
      returnUrl: getBillingReturnUrl(request),
    });
  } catch (error) {
    if (isBillingApiUnavailableError(error)) {
      throw new BillingConfigurationError();
    }
    throw error;
  }
}

export async function cancelProSubscription(
  request: Request,
  billing: AdminBilling,
  shop: string,
): Promise<{ clearedDevCookie?: string }> {
  if (isBillingDevBypass()) {
    return { clearedDevCookie: await clearDevBillingPlan(shop) };
  }

  const info = await getSubscriptionInfo(request, billing, shop);
  const subscription = info.appSubscriptions[0];

  if (!subscription?.id) {
    return {};
  }

  await billing.cancel({
    subscriptionId: subscription.id,
    isTest: isBillingTestMode(),
    prorate: true,
  });

  return {};
}
