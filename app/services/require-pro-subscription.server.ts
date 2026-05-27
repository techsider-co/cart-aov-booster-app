import { redirect } from "react-router";

import { APP_ROUTES } from "../billing/plans";
import { authenticate } from "../shopify.server";
import { checkProSubscription } from "./shop-subscription.server";

/**
 * Hard gate for Pro-only widget configuration routes.
 */
export async function requireProSubscription(request: Request) {
  const { session, admin, billing } = await authenticate.admin(request);
  const { isPro } = await checkProSubscription(request, billing, session.shop);

  if (!isPro) {
    throw redirect(APP_ROUTES.billing);
  }

  return { session, admin, billing, isPro: true as const };
}
