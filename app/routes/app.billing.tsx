import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { AppRouteErrorBoundary } from "../components/AppRouteErrorBoundary";
import BillingPage from "../components/BillingPage";
import {
  ANNUAL_PRO_PLAN,
  APP_ROUTES,
  MONTHLY_PRO_PLAN,
  PRO_PLAN_OPTIONS,
  describeActivePlan,
  getTargetPlan,
  isPaidProPlan,
} from "../billing/plans";
import {
  isBillingDevBypass,
  isBillingTestMode,
} from "../billing/plans.server";
import { BillingConfigurationError } from "../services/billing-dev.server";
import {
  cancelProSubscription,
  getSubscriptionInfo,
  requestPaidSubscription,
} from "../services/shop-subscription.server";
import { authenticate } from "../shopify.server";

const CONFIRM_RETRY_MS = 1500;
const CONFIRM_RETRY_COUNT = 4;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);
  const subscribed = url.searchParams.get("subscribed");
  const success = url.searchParams.get("success");
  const error = url.searchParams.get("error");
  const requestedPlan = url.searchParams.get("plan");

  try {
    if (subscribed === "1") {
      let info = await getSubscriptionInfo(request, billing, shop);

      if (!info.isPro) {
        for (let i = 0; i < CONFIRM_RETRY_COUNT; i++) {
          await new Promise((resolve) => setTimeout(resolve, CONFIRM_RETRY_MS));
          info = await getSubscriptionInfo(request, billing, shop);
          if (info.isPro) {
            break;
          }
        }
      }

      if (info.isPro) {
        throw redirect(`${APP_ROUTES.billing}?success=subscribed`);
      }

      throw redirect(`${APP_ROUTES.billing}?error=confirm_failed`);
    }

    const info = await getSubscriptionInfo(request, billing, shop);

    if (
      requestedPlan &&
      isPaidProPlan(requestedPlan) &&
      !info.isPro
    ) {
      return requestPaidSubscription(request, billing, shop, requestedPlan);
    }

    return {
      isPro: info.isPro,
      activePlan: info.activePlan,
      activePlanLabel: describeActivePlan(info.activePlan),
      subscription: info.appSubscriptions[0] ?? null,
      plans: PRO_PLAN_OPTIONS,
      isTestMode: isBillingTestMode(),
      isDevBypass: info.isDevBypass,
      success,
      error,
      configurationError: null as string | null,
      monthlyPlan: MONTHLY_PRO_PLAN,
      annualPlan: ANNUAL_PRO_PLAN,
      upgradeTarget:
        info.activePlan === MONTHLY_PRO_PLAN ? ANNUAL_PRO_PLAN : null,
      downgradeTarget:
        info.activePlan === ANNUAL_PRO_PLAN ? MONTHLY_PRO_PLAN : null,
    };
  } catch (caught) {
    if (caught instanceof BillingConfigurationError) {
      return {
        isPro: false,
        activePlan: null,
        activePlanLabel: describeActivePlan(null),
        subscription: null,
        plans: PRO_PLAN_OPTIONS,
        isTestMode: isBillingTestMode(),
        isDevBypass: false,
        success: null,
        error: null,
        configurationError: caught.message,
        monthlyPlan: MONTHLY_PRO_PLAN,
        annualPlan: ANNUAL_PRO_PLAN,
        upgradeTarget: null,
        downgradeTarget: null,
      };
    }
    throw caught;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "subscribe") {
    const plan = formData.get("plan");
    if (typeof plan !== "string" || !isPaidProPlan(plan)) {
      return { error: "Geçersiz plan seçimi." as const };
    }
    throw redirect(
      `${APP_ROUTES.billing}?plan=${encodeURIComponent(plan)}`,
    );
  }

  if (intent === "upgrade" || intent === "downgrade") {
    const info = await getSubscriptionInfo(request, billing, shop);
    const target =
      intent === "upgrade" && info.activePlan === MONTHLY_PRO_PLAN
        ? ANNUAL_PRO_PLAN
        : intent === "downgrade" && info.activePlan === ANNUAL_PRO_PLAN
          ? MONTHLY_PRO_PLAN
          : getTargetPlan(info.activePlan);

    throw redirect(
      `${APP_ROUTES.billing}?plan=${encodeURIComponent(target)}`,
    );
  }

  if (intent === "cancel") {
    try {
      const { clearedDevCookie } = await cancelProSubscription(
        request,
        billing,
        shop,
      );

      const headers = clearedDevCookie
        ? { "Set-Cookie": clearedDevCookie }
        : undefined;

      throw redirect(`${APP_ROUTES.billing}?success=cancelled`, {
        headers,
      });
    } catch (error) {
      if (error instanceof BillingConfigurationError) {
        return { error: error.message };
      }
      throw error;
    }
  }

  return { error: "Geçersiz işlem." as const };
};

export default BillingPage;

export function ErrorBoundary() {
  return <AppRouteErrorBoundary />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
