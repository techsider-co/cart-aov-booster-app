import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { AppRouteErrorBoundary } from "../components/AppRouteErrorBoundary";
import { requireProSubscription } from "../services/require-pro-subscription.server";
import { buildAppEmbedDeepLinkUrl } from "../services/theme-check.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await requireProSubscription(request);

  const themeEditorUrl = buildAppEmbedDeepLinkUrl(
    session.shop,
    "free_shipping_bar",
    "index"
  );

  return { themeEditorUrl };
};

export default function ShippingBarPage() {
  const { themeEditorUrl } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Shipping Bar">
      <s-section>
        <s-box
          background="info-subdued"
          borderRadius="large"
          padding="large"
        >
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-icon type="info" tone="info" />
              <s-text type="strong">
                Shipping Bar ayarları tema editöründen yapılır
              </s-text>
            </s-stack>
            <s-paragraph>
              Shipping Bar artık doğrudan tema editöründen yapılandırılır. Bu
              sayede değişikliklerinizi anında önizleyebilir ve ayarları kolayca
              düzenleyebilirsiniz.
            </s-paragraph>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Nasıl Kullanılır?">
        <s-stack direction="block" gap="base">
          <s-box border="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-badge tone="info">Adım 1</s-badge>
              <s-text type="strong">Tema editörünü açın</s-text>
              <s-paragraph color="subdued">
                Aşağıdaki butona tıklayarak doğrudan Shipping Bar ayarlarına
                gidin.
              </s-paragraph>
            </s-stack>
          </s-box>

          <s-box border="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-badge tone="info">Adım 2</s-badge>
              <s-text type="strong">Uygulama eklemelerini açın</s-text>
              <s-paragraph color="subdued">
                Sol menüden <s-text type="strong">Uygulama eklemeleri</s-text>{" "}
                bölümüne gidin (puzzle ikonu).
              </s-paragraph>
            </s-stack>
          </s-box>

          <s-box border="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-badge tone="info">Adım 3</s-badge>
              <s-text type="strong">Shipping Bar&apos;ı etkinleştirin</s-text>
              <s-paragraph color="subdued">
                <s-text type="strong">Shipping Bar</s-text> yanındaki anahtarı
                açın. Ardından üzerine tıklayarak ayarları düzenleyin.
              </s-paragraph>
            </s-stack>
          </s-box>

          <s-box border="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-badge tone="success">Adım 4</s-badge>
              <s-text type="strong">Ayarları yapılandırın</s-text>
              <s-paragraph color="subdued">
                Hedef tutarı, mesajları ve renkleri ihtiyacınıza göre
                ayarlayın. Değişiklikler anında önizlenir.
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Ayarlar">
        <s-paragraph color="subdued">
          Tema editöründe aşağıdaki ayarları yapılandırabilirsiniz:
        </s-paragraph>
        <s-stack direction="block" gap="small">
          <s-box
            border="base"
            borderRadius="base"
            padding="small"
            background="subdued"
          >
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-icon type="target" />
              <s-text type="strong">Hedef Tutarı</s-text>
              <s-text color="subdued">
                — Ücretsiz kargo için gereken minimum sepet tutarı
              </s-text>
            </s-stack>
          </s-box>
          <s-box
            border="base"
            borderRadius="base"
            padding="small"
            background="subdued"
          >
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-icon type="text" />
              <s-text type="strong">Metinler</s-text>
              <s-text color="subdued">
                — Başlangıç, ilerleme ve başarı mesajları
              </s-text>
            </s-stack>
          </s-box>
          <s-box
            border="base"
            borderRadius="base"
            padding="small"
            background="subdued"
          >
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-icon type="paint-brush" />
              <s-text type="strong">Renkler</s-text>
              <s-text color="subdued">
                — Arka plan, metin, ilerleme dolgu ve çubuk arka planı
              </s-text>
            </s-stack>
          </s-box>
          <s-box
            border="base"
            borderRadius="base"
            padding="small"
            background="subdued"
          >
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-icon type="text-font" />
              <s-text type="strong">Görünüm</s-text>
              <s-text color="subdued">
                — Çubuk yüksekliği, yazı boyutu, yazı tipi ve ilerleme kalınlığı
              </s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {themeEditorUrl && (
        <s-section>
          <s-button href={themeEditorUrl} target="_blank" variant="primary">
            Tema Editöründe Aç
          </s-button>
        </s-section>
      )}
    </s-page>
  );
}

export function ErrorBoundary() {
  return <AppRouteErrorBoundary />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
