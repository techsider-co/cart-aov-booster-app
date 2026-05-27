import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useOutletContext } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { APP_ROUTES } from "../billing/plans";
import {
  buildAppBlockDeepLinkUrl,
  buildAppEmbedDeepLinkUrl,
  getCartBoosterThemeSetupStatus,
} from "../services/theme-check.server";
import { syncInfluencedOrdersFromAdmin } from "../services/roi-analytics.server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

type AppOutletContext = {
  isPro: boolean;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + " ";
  return `${symbol}${amount.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const themeSetup = await getCartBoosterThemeSetupStatus(admin);
  const shippingBarEmbedDeepLinkUrl = buildAppEmbedDeepLinkUrl(
    session.shop,
    "free_shipping_bar",
  );
  const stickyCartBlockDeepLinkUrl = buildAppBlockDeepLinkUrl(
    session.shop,
    "sticky_cart",
    "product",
  );

  await syncInfluencedOrdersFromAdmin(session.shop, admin);

  const analytics = await db.shopAnalytics.findUnique({
    where: { shop: session.shop },
  });

  const roiData = {
    totalRoi: analytics?.totalRoi ?? 0,
    ordersInfluenced: analytics?.ordersInfluenced ?? 0,
    currency: analytics?.currency ?? "TRY",
  };

  return {
    themeSetup,
    shippingBarEmbedDeepLinkUrl,
    stickyCartBlockDeepLinkUrl,
    roiData,
  };
};

export default function Dashboard() {
  const {
    themeSetup,
    shippingBarEmbedDeepLinkUrl,
    stickyCartBlockDeepLinkUrl,
    roiData,
  } = useLoaderData<typeof loader>();
  const { isPro } = useOutletContext<AppOutletContext>();

  const formattedRoi = formatCurrency(roiData.totalRoi, roiData.currency);

  return (
    <s-page heading="Cart &amp; AOV Booster">
      <s-section>
        <s-box
          background="success-subdued"
          borderRadius="large"
          padding="large"
        >
          <s-stack direction="block" gap="base" alignItems="center">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-icon type="chart-line" tone="success" />
              <s-text type="strong" tone="success">
                AOV Booster Sayesinde Kazanılan Ekstra Gelir
              </s-text>
            </s-stack>
            <s-text
              type="heading-lg"
              style={{ fontSize: "2.5rem", fontWeight: "bold" }}
            >
              {formattedRoi}
            </s-text>
            <s-paragraph color="subdued" style={{ textAlign: "center" }}>
              Bu gelir, doğrudan Yapışkan Buton etkileşimlerinden elde
              edilmiştir.
              <br />
              <s-text type="strong">
                Toplam etkilenen sipariş: {roiData.ordersInfluenced}
              </s-text>
            </s-paragraph>
          </s-stack>
        </s-box>
      </s-section>

      {!themeSetup.isFullyConfigured && (
        <s-section>
          <s-banner
            tone="critical"
            heading="Tema kurulumunu tamamlayın"
          >
            <s-stack direction="block" gap="small">
              <s-paragraph>
                Widget&apos;ların mağazada görünmesi için aşağıdaki adımları
                tamamlayın. Uygulama ayarlarında &quot;Widget aktif&quot;
                anahtarını da açmayı unutmayın.
              </s-paragraph>
              {!themeSetup.shippingBarEmbedEnabled && (
                <s-paragraph>
                  <s-text type="strong">1. Free Shipping Bar:</s-text> Tema
                  editöründe{" "}
                  <s-text type="strong">Uygulama eklemeleri</s-text> bölümünden
                  &quot;Free Shipping Bar&quot;ı etkinleştirin.
                </s-paragraph>
              )}
              {!themeSetup.stickyCartBlockEnabled && (
                <s-paragraph>
                  <s-text type="strong">2. Sticky Add-to-Cart:</s-text> Ürün
                  şablonunda bir bölüme{" "}
                  <s-text type="strong">Sticky Add-to-Cart</s-text> bloğunu
                  ekleyin.
                </s-paragraph>
              )}
            </s-stack>
            <s-stack direction="inline" gap="small">
              {!themeSetup.shippingBarEmbedEnabled &&
                shippingBarEmbedDeepLinkUrl && (
                  <s-button
                    href={shippingBarEmbedDeepLinkUrl}
                    target="_blank"
                    variant="primary"
                  >
                    Kargo çubuğunu etkinleştir
                  </s-button>
                )}
              {!themeSetup.stickyCartBlockEnabled &&
                stickyCartBlockDeepLinkUrl && (
                  <s-button
                    href={stickyCartBlockDeepLinkUrl}
                    target="_blank"
                    variant={themeSetup.shippingBarEmbedEnabled ? "primary" : undefined}
                  >
                    Yapışkan sepete ekle bloğunu ekle
                  </s-button>
                )}
            </s-stack>
          </s-banner>
        </s-section>
      )}

      {!isPro && (
        <s-section>
          <s-banner tone="warning" heading="Pro plan gerekli">
            <s-paragraph>
              Shipping Bar ve Sticky Cart yapılandırması için AOV Booster Pro
              aboneliği gereklidir.
            </s-paragraph>
            <s-box paddingBlockStart="small">
              <s-button href={APP_ROUTES.billing} variant="primary">
                Plan seç
              </s-button>
            </s-box>
          </s-banner>
        </s-section>
      )}

      <s-section heading="Modüller">
        <s-paragraph color="subdued">
          Sepet ortalamasını (AOV) artırmak için mağazanıza ekleyebileceğiniz
          widget&apos;ları yapılandırın.
        </s-paragraph>
      </s-section>

      <s-section padding="base">
        <s-grid
          gridTemplateColumns="@container (inline-size <= 640px) 1fr, 1fr 1fr"
          gap="large"
        >
          <s-box
            border="base"
            borderRadius="base"
            padding="large"
            background="base"
          >
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-icon type="delivery" tone="auto" />
                <s-heading>Free Shipping Bar</s-heading>
                {!isPro && <s-badge tone="warning">Pro</s-badge>}
              </s-stack>
              <s-paragraph color="subdued">
                Sepet tutarına göre dinamik ilerleyen kargo çubuğu. Tema
                editöründe uygulama eklemesi olarak etkinleştirilir.
              </s-paragraph>
              <s-box paddingBlockStart="small">
                {isPro ? (
                  <s-button href="/app/shipping-bar" variant="primary">
                    Yapılandır
                  </s-button>
                ) : (
                  <s-button href={APP_ROUTES.billing} variant="primary">
                    Pro ile aç
                  </s-button>
                )}
              </s-box>
            </s-stack>
          </s-box>

          <s-box
            border="base"
            borderRadius="base"
            padding="large"
            background="base"
          >
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-icon type="cart" tone="auto" />
                <s-heading>Sticky Add-to-Cart</s-heading>
                {!isPro && <s-badge tone="warning">Pro</s-badge>}
              </s-stack>
              <s-paragraph color="subdued">
                Ürün sayfasına eklenebilen yapışkan sepete ekle butonu.
              </s-paragraph>
              <s-box paddingBlockStart="small">
                {isPro ? (
                  <s-button href="/app/sticky-cart" variant="primary">
                    Yapılandır
                  </s-button>
                ) : (
                  <s-button href={APP_ROUTES.billing} variant="primary">
                    Pro ile aç
                  </s-button>
                )}
              </s-box>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
