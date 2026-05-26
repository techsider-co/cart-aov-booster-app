import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Dashboard() {
  return (
    <s-page heading="Cart &amp; AOV Booster">
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
              </s-stack>
              <s-paragraph color="subdued">
                Sepet tutarına göre dinamik ilerleyen kargo çubuğu.
              </s-paragraph>
              <s-box paddingBlockStart="small">
                <s-button href="/app/shipping-bar" variant="primary">
                  Yapılandır
                </s-button>
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
              </s-stack>
              <s-paragraph color="subdued">
                Satışları kaçırmamak için sayfada kaybolmayan sepete ekle
                butonu.
              </s-paragraph>
              <s-box paddingBlockStart="small">
                <s-button href="/app/sticky-cart" variant="primary">
                  Yapılandır
                </s-button>
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
