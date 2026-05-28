import { Prisma } from "@prisma/client";

import db from "../db.server";

interface AdminGraphQLClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

const RECENT_INFLUENCED_ORDERS_QUERY = `#graphql
  query RoiRecentOrders {
    orders(first: 50, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        customAttributes {
          key
          value
        }
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

function isAovBoosterInfluenced(
  attributes: Array<{ key: string; value: string }> | undefined,
): boolean {
  return (
    attributes?.some(
      (attr) => attr.key === "_aov_booster" && attr.value === "true",
    ) ?? false
  );
}

/**
 * Records one influenced order exactly once per shop (idempotent).
 * Returns true when analytics were incremented.
 */
export async function recordInfluencedOrder(
  shop: string,
  orderId: string,
  totalPrice: number,
  currency: string,
): Promise<boolean> {
  if (totalPrice <= 0) {
    return false;
  }

  try {
    await db.influencedOrder.create({
      data: {
        shop,
        orderId,
        amount: totalPrice,
        currency,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }

  await db.shopAnalytics.upsert({
    where: { shop },
    create: {
      shop,
      totalRoi: totalPrice,
      ordersInfluenced: 1,
      currency,
    },
    update: {
      totalRoi: { increment: totalPrice },
      ordersInfluenced: { increment: 1 },
      currency,
    },
  });

  return true;
}

/**
 * Backfills ROI from recent orders via Admin API (no orders/create webhook required).
 * Skips silently when protected customer data access is not configured yet.
 */
export async function syncInfluencedOrdersFromAdmin(
  shop: string,
  graphql: AdminGraphQLClient,
): Promise<void> {
  try {
    const response = await graphql.graphql(RECENT_INFLUENCED_ORDERS_QUERY);
    const json = (await response.json()) as {
      data?: {
        orders?: {
          nodes?: Array<{
            id?: string;
            customAttributes?: Array<{ key: string; value: string }>;
            totalPriceSet?: {
              shopMoney?: { amount?: string; currencyCode?: string };
            };
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (json.errors?.length) {
      console.warn(
        "ROI sync skipped (Orders API):",
        json.errors.map((e) => e.message).join(", "),
      );
      return;
    }

    const nodes = json.data?.orders?.nodes ?? [];

    for (const node of nodes) {
      if (!node.id || !isAovBoosterInfluenced(node.customAttributes)) {
        continue;
      }

      const amount = parseFloat(node.totalPriceSet?.shopMoney?.amount ?? "0");
      const currency =
        node.totalPriceSet?.shopMoney?.currencyCode ?? "TRY";

      await recordInfluencedOrder(shop, node.id, amount, currency);
    }
  } catch (error) {
    console.warn(
      "ROI sync failed:",
      error instanceof Error ? error.message : error,
    );
  }
}
