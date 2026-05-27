import { Form, useLoaderData, useNavigation } from "react-router";

import { APP_ROUTES } from "../billing/plans";
import type { loader } from "../routes/app.billing";

export default function BillingPage() {
  const {
    isPro,
    activePlanLabel,
    subscription,
    plans,
    isTestMode,
    isDevBypass,
    success,
    error,
    configurationError,
    upgradeTarget,
    downgradeTarget,
  } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page heading="AOV Booster Pro">
      {configurationError && (
        <s-section>
          <s-banner tone="critical" heading="Billing API kullanılamıyor">
            <s-paragraph>{configurationError}</s-paragraph>
            <s-paragraph color="subdued">
              Yerel simülasyon: <code>SHOPIFY_BILLING_DEV_BYPASS=true</code>.
              Gerçek test checkout: Partner Dashboard → Public (taslak yeterli),{" "}
              <code>SHOPIFY_BILLING_DEV_BYPASS=false</code>.
            </s-paragraph>
          </s-banner>
        </s-section>
      )}

      {success === "subscribed" && (
        <s-section>
          <s-banner tone="success" heading="Abonelik aktif">
            <s-paragraph>
              AOV Booster Pro başarıyla etkinleştirildi. Artık widget&apos;ları
              yapılandırabilirsiniz.
              {isTestMode && !isDevBypass && " (Shopify test modu)"}
              {isDevBypass && " (geliştirme simülasyonu)"}
            </s-paragraph>
          </s-banner>
          <s-stack direction="inline" gap="base" paddingBlockStart="base">
            <s-button href="/app/shipping-bar" variant="primary">
              Shipping Bar
            </s-button>
            <s-button href="/app/sticky-cart" variant="primary">
              Sticky Cart
            </s-button>
            <s-button href={APP_ROUTES.home} variant="secondary">
              Dashboard
            </s-button>
          </s-stack>
        </s-section>
      )}

      {success === "cancelled" && (
        <s-section>
          <s-banner tone="info" heading="Abonelik iptal edildi">
            <s-paragraph>
              Widget yapılandırmaları Free plan limitlerine döndü.
            </s-paragraph>
          </s-banner>
        </s-section>
      )}

      {error === "confirm_failed" && (
        <s-section>
          <s-banner tone="warning" heading="Onay doğrulanamadı">
            <s-paragraph>
              Shopify henüz aboneliği yansıtmamış olabilir. Birkaç saniye sonra
              sayfayı yenileyin veya planı tekrar seçin.
            </s-paragraph>
          </s-banner>
        </s-section>
      )}

      {isDevBypass && (
        <s-section>
          <s-banner tone="info" heading="Geliştirme satın alma simülasyonu">
            <s-paragraph>
              Billing API atlanıyor; plan seçimi çerez ile simüle edilir.
              Gerçek Shopify onayı için Public dağıtım +{" "}
              <code>SHOPIFY_BILLING_DEV_BYPASS=false</code>.
            </s-paragraph>
          </s-banner>
        </s-section>
      )}

      {isTestMode && !isDevBypass && (
        <s-section>
          <s-banner tone="info" heading="Test faturalandırma modu">
            <s-paragraph>
              <code>SHOPIFY_BILLING_TEST=true</code> — gerçek karttan ücret
              alınmaz. Canlıda <code>SHOPIFY_BILLING_TEST=false</code> yapın.
            </s-paragraph>
          </s-banner>
        </s-section>
      )}

      {isPro && (
        <s-section heading="Aktif abonelik">
          <s-banner tone="success" heading="Pro planınız aktif">
            <s-paragraph>
              Plan: <strong>{activePlanLabel}</strong>
              {subscription?.test && " · Shopify test"}
            </s-paragraph>
          </s-banner>

          <s-stack direction="inline" gap="base" paddingBlockStart="base">
            <s-button href={APP_ROUTES.home} variant="primary">
              Dashboard
            </s-button>
            {upgradeTarget && (
              <Form method="post">
                <input type="hidden" name="intent" value="upgrade" />
                <s-button type="submit" variant="secondary" disabled={isSubmitting}>
                  Yıllığa geç
                </s-button>
              </Form>
            )}
            {downgradeTarget && (
              <Form method="post">
                <input type="hidden" name="intent" value="downgrade" />
                <s-button type="submit" variant="secondary" disabled={isSubmitting}>
                  Aylığa geç
                </s-button>
              </Form>
            )}
            <Form method="post">
              <input type="hidden" name="intent" value="cancel" />
              <s-button
                type="submit"
                variant="tertiary"
                tone="critical"
                disabled={isSubmitting}
              >
                Aboneliği iptal et
              </s-button>
            </Form>
          </s-stack>
        </s-section>
      )}

      {!isPro && !configurationError && (
        <s-section heading="Plan seçin">
          <s-paragraph color="subdued">
            Free planda yalnızca dashboard kullanılabilir. Shipping Bar ve Sticky
            Cart için Pro aboneliği gerekir ($14.99/ay veya $149.90/yıl).
          </s-paragraph>

          <s-grid
            gridTemplateColumns="@container (inline-size <= 640px) 1fr, 1fr 1fr"
            gap="large"
            paddingBlockStart="large"
          >
            {plans.map((planOption) => (
              <s-box
                key={planOption.id}
                border="base"
                borderRadius="base"
                padding="large"
                background="base"
              >
                <s-stack direction="block" gap="base">
                  <s-heading>{planOption.name}</s-heading>
                  <s-text type="strong">
                    {planOption.priceLabel} / {planOption.intervalLabel}
                  </s-text>
                  <s-paragraph color="subdued">
                    {planOption.description}
                  </s-paragraph>
                  <Form method="post">
                    <input type="hidden" name="intent" value="subscribe" />
                    <input type="hidden" name="plan" value={planOption.id} />
                    <s-button
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? "Yönlendiriliyor…"
                        : isDevBypass
                          ? "Test olarak başlat"
                          : "Pro'yu başlat"}
                    </s-button>
                  </Form>
                </s-stack>
              </s-box>
            ))}
          </s-grid>
        </s-section>
      )}
    </s-page>
  );
}
