import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  await db.session.deleteMany({ where: { shop } });

  await db.shippingBarWidget.updateMany({
    where: { shop },
    data: { isActive: false },
  });

  await db.stickyCartWidget.updateMany({
    where: { shop },
    data: { isActive: false },
  });

  await db.shopProSubscription.deleteMany({ where: { shop } });

  return new Response(null, { status: 200 });
};
