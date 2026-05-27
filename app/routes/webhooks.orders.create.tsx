import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { recordInfluencedOrder } from "../services/roi-analytics.server";

interface NoteAttribute {
  name: string;
  value: string;
}

interface OrderWebhookPayload {
  id: number;
  total_price: string;
  currency: string;
  note_attributes?: NoteAttribute[];
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const order = payload as OrderWebhookPayload;

  const isAovBoosterInfluenced = order.note_attributes?.some(
    (attr) => attr.name === "_aov_booster" && attr.value === "true",
  );

  if (!isAovBoosterInfluenced) {
    return new Response(null, { status: 200 });
  }

  const totalPrice = parseFloat(order.total_price) || 0;

  try {
    const recorded = await recordInfluencedOrder(
      shop,
      String(order.id),
      totalPrice,
      order.currency || "TRY",
    );

    if (recorded) {
      console.log(
        `AOV Booster ROI updated for ${shop}: +${totalPrice} ${order.currency}`,
      );
    }
  } catch (error) {
    console.error("Failed to update ShopAnalytics:", error);
  }

  return new Response(null, { status: 200 });
};
