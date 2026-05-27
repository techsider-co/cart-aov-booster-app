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

const APP_INSTALLATION_QUERY = `#graphql
  query AppInstallationQuery {
    currentAppInstallation {
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

const SHOP_ID_FOR_LEGACY_CLEANUP_QUERY = `#graphql
  query LegacyShopMetafieldsOwner {
    shop {
      id
    }
  }
`;

const DELETE_LEGACY_SHOP_METAFIELDS_MUTATION = `#graphql
  mutation DeleteLegacyShopAovMetafields(
    $metafields: [MetafieldIdentifierInput!]!
  ) {
    metafieldsDelete(metafields: $metafields) {
      deletedMetafields {
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

const AOV_BOOSTER_NAMESPACE = "aov_booster";
const LEGACY_SHOP_METAFIELD_KEYS = [
  "shipping_bar_config",
  "sticky_cart_config",
] as const;

export async function syncAovMetafields(
  shop: string,
  graphql: AdminGraphQLClient,
) {
  const [shippingBar, stickyCart] = await Promise.all([
    getOrCreateShippingBarWidget(shop),
    getOrCreateStickyCartWidget(shop),
  ]);

  const installationResponse = await graphql.graphql(APP_INSTALLATION_QUERY);
  const installationJson = (await installationResponse.json()) as {
    data?: { currentAppInstallation?: { id?: string } };
  };

  const appInstallationId =
    installationJson.data?.currentAppInstallation?.id;
  if (!appInstallationId) {
    throw new Error("Uygulama kurulum kimliği alınamadı.");
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
          ownerId: appInstallationId,
          namespace: AOV_BOOSTER_NAMESPACE,
          key: "shipping_bar_config",
          type: "json",
          value: JSON.stringify(shippingBarConfig),
        },
        {
          ownerId: appInstallationId,
          namespace: AOV_BOOSTER_NAMESPACE,
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

  await deleteLegacyShopAovMetafields(graphql);

  return metafieldsJson.data?.metafieldsSet?.metafields;
}

/**
 * Removes widget config previously stored on Shop (pre–AppInstallation migration).
 * Failures are non-fatal so sync still succeeds if legacy values are already gone.
 */
async function deleteLegacyShopAovMetafields(
  graphql: AdminGraphQLClient,
): Promise<void> {
  try {
    const shopResponse = await graphql.graphql(SHOP_ID_FOR_LEGACY_CLEANUP_QUERY);
    const shopJson = (await shopResponse.json()) as {
      data?: { shop?: { id?: string } };
    };

    const shopId = shopJson.data?.shop?.id;
    if (!shopId) {
      return;
    }

    const deleteResponse = await graphql.graphql(
      DELETE_LEGACY_SHOP_METAFIELDS_MUTATION,
      {
        variables: {
          metafields: LEGACY_SHOP_METAFIELD_KEYS.map((key) => ({
            ownerId: shopId,
            namespace: AOV_BOOSTER_NAMESPACE,
            key,
          })),
        },
      },
    );

    const deleteJson = (await deleteResponse.json()) as {
      data?: {
        metafieldsDelete?: {
          userErrors?: Array<{ message: string }>;
        };
      };
    };

    const deleteErrors = deleteJson.data?.metafieldsDelete?.userErrors ?? [];
    if (deleteErrors.length > 0) {
      console.warn(
        "Legacy shop metafield cleanup:",
        deleteErrors.map((error) => error.message).join(", "),
      );
    }
  } catch (error) {
    console.warn(
      "Legacy shop metafield cleanup skipped:",
      error instanceof Error ? error.message : error,
    );
  }
}
