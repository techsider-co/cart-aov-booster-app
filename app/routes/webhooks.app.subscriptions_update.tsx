import type { ActionFunctionArgs } from "react-router";

import db from "../db.server";
import { authenticate } from "../shopify.server";

const INACTIVE_STATUSES = new Set([
  "CANCELLED",
  "DECLINED",
  "EXPIRED",
  "FROZEN",
]);

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const subscription = payload as {
    app_subscription?: { status?: string; name?: string };
  };

  const status = subscription.app_subscription?.status;

  if (status && INACTIVE_STATUSES.has(status)) {
    await db.shippingBarWidget.updateMany({
      where: { shop },
      data: { isActive: false },
    });

    await db.stickyCartWidget.updateMany({
      where: { shop },
      data: { isActive: false },
    });

    await db.shopProSubscription.deleteMany({ where: { shop } });

    console.log(
      `Deactivated widgets for ${shop} after subscription status: ${status}`,
    );
  }

  return new Response(null, { status: 200 });
};
