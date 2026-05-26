import {
  getOrCreateShippingBarWidget,
  getOrCreateStickyCartWidget,
} from "./widget-settings.server";

interface AdminGraphQLClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

const SHOP_ID_QUERY = `#graphql
  query SyncAovShopId {
    shop {
      id
    }
  }
`;

const METAFIELDS_SET_MUTATION = `#graphql
  mutation SyncAovMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        key
        namespace
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function syncAovMetafields(
  shop: string,
  graphql: AdminGraphQLClient,
) {
  const [shippingBar, stickyCart] = await Promise.all([
    getOrCreateShippingBarWidget(shop),
    getOrCreateStickyCartWidget(shop),
  ]);

  const shopResponse = await graphql.graphql(SHOP_ID_QUERY);
  const shopJson = (await shopResponse.json()) as {
    data?: { shop?: { id?: string } };
  };

  const shopId = shopJson.data?.shop?.id;
  if (!shopId) {
    throw new Error("Mağaza kimliği alınamadı.");
  }

  const shippingBarConfig = {
    isActive: shippingBar.isActive,
    goalAmount: shippingBar.goalAmount,
    currency: shippingBar.currency,
    initialMessage: shippingBar.initialMessage,
    progressMessage: shippingBar.progressMessage,
    successMessage: shippingBar.successMessage,
    barColor: shippingBar.barColor,
    progressColor: shippingBar.progressColor,
  };

  const stickyCartConfig = {
    isActive: stickyCart.isActive,
    position: stickyCart.position,
    buttonColor: stickyCart.buttonColor,
    buttonText: stickyCart.buttonText,
    hideOnDesktop: stickyCart.hideOnDesktop,
  };

  const metafieldsResponse = await graphql.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          namespace: "aov_booster",
          key: "shipping_bar_config",
          type: "json",
          value: JSON.stringify(shippingBarConfig),
        },
        {
          ownerId: shopId,
          namespace: "aov_booster",
          key: "sticky_cart_config",
          type: "json",
          value: JSON.stringify(stickyCartConfig),
        },
      ],
    },
  });

  const metafieldsJson = (await metafieldsResponse.json()) as {
    data?: {
      metafieldsSet?: {
        metafields?: Array<{ key: string; namespace: string }>;
        userErrors?: Array<{ field?: string[]; message: string }>;
      };
    };
  };

  const userErrors = metafieldsJson.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(
      userErrors.map((error) => error.message).join(", ") ||
        "Metafield senkronizasyonu başarısız.",
    );
  }

  return metafieldsJson.data?.metafieldsSet?.metafields;
}
