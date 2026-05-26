import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";

import { AppRouteErrorBoundary } from "../components/AppRouteErrorBoundary";
import prisma from "../db.server";
import { useActionToast } from "../hooks/use-action-toast";
import { syncAovMetafields } from "../services/sync-aov-metafields.server";
import {
  getOrCreateShippingBarWidget,
  parseBooleanField,
} from "../services/widget-settings.server";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

const CURRENCY_OPTIONS = ["TRY", "USD", "EUR", "GBP"] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getOrCreateShippingBarWidget(session.shop);

  return { settings, currencyOptions: CURRENCY_OPTIONS };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const goalAmountRaw = formData.get("goalAmount");
  const goalAmount = Number(goalAmountRaw);

  if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
    return {
      success: false as const,
      error: "Geçerli bir hedef tutar girin.",
    };
  }

  try {
    await prismaUpdateShippingBar(session.shop, formData, goalAmount);
    await syncAovMetafields(session.shop, admin);

    const settings = await getOrCreateShippingBarWidget(session.shop);
    return { success: true as const, settings };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Ayarlar kaydedilirken bir hata oluştu.",
    };
  }
};

async function prismaUpdateShippingBar(
  shop: string,
  formData: FormData,
  goalAmount: number,
) {
  return prisma.shippingBarWidget.upsert({
    where: { shop },
    create: {
      shop,
      isActive: parseBooleanField(formData.get("isActive")),
      goalAmount,
      currency: String(formData.get("currency") ?? "TRY"),
      initialMessage: String(formData.get("initialMessage") ?? ""),
      progressMessage: String(formData.get("progressMessage") ?? ""),
      successMessage: String(formData.get("successMessage") ?? ""),
      barColor: String(formData.get("barColor") ?? "#000000"),
      progressColor: String(formData.get("progressColor") ?? "#22c55e"),
    },
    update: {
      isActive: parseBooleanField(formData.get("isActive")),
      goalAmount,
      currency: String(formData.get("currency") ?? "TRY"),
      initialMessage: String(formData.get("initialMessage") ?? ""),
      progressMessage: String(formData.get("progressMessage") ?? ""),
      successMessage: String(formData.get("successMessage") ?? ""),
      barColor: String(formData.get("barColor") ?? "#000000"),
      progressColor: String(formData.get("progressColor") ?? "#22c55e"),
    },
  });
}

type ActionData = Awaited<ReturnType<typeof action>>;

export default function ShippingBarPage() {
  const { settings, currencyOptions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();
  const isSaving =
    fetcher.state === "submitting" || fetcher.state === "loading";

  const formSettings =
    fetcher.data?.success === true ? fetcher.data.settings : settings;

  useActionToast({
    data: fetcher.data,
    isSuccess: (data) => data.success === true,
    successMessage: "Kargo çubuğu ayarları kaydedildi.",
    getErrorMessage: (data) =>
      data.success === false ? data.error : undefined,
  });

  return (
    <fetcher.Form method="post" data-save-bar>
      <s-page heading="Free Shipping Bar">
        <s-button
          slot="primary-action"
          type="submit"
          variant="primary"
          {...(isSaving ? { loading: true } : {})}
        >
          Kaydet
        </s-button>

        <s-section heading="Durum">
          <s-paragraph color="subdued">
            Kargo motivasyon çubuğunu mağazanızda göstermek için etkinleştirin.
          </s-paragraph>
          <input type="hidden" name="isActive" value="false" />
          <s-switch
            label="Widget aktif"
            name="isActive"
            value="true"
            checked={formSettings.isActive || undefined}
          />
        </s-section>

        <s-section heading="Hedef">
          <s-paragraph color="subdued">
            Müşterilerin ulaşması gereken ücretsiz kargo eşiğini belirleyin.
          </s-paragraph>
          <s-stack direction="block" gap="base">
            <s-number-field
              label="Kargo bedava hedef tutarı"
              name="goalAmount"
              value={String(formSettings.goalAmount)}
              min={1}
              step={1}
              required
            />
            <s-select
              label="Para birimi"
              name="currency"
              value={formSettings.currency}
            >
              {currencyOptions.map((currency) => (
                <s-option key={currency} value={currency}>
                  {currency}
                </s-option>
              ))}
            </s-select>
          </s-stack>
        </s-section>

        <s-section heading="Metinler">
          <s-paragraph color="subdued">
            İlerleme metninde kalan tutarı göstermek için{" "}
            <s-text type="strong">[amount]</s-text> değişkenini kullanabilirsiniz.
          </s-paragraph>
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Başlangıç metni"
              name="initialMessage"
              value={formSettings.initialMessage}
              required
            />
            <s-text-field
              label="İlerleme metni"
              name="progressMessage"
              value={formSettings.progressMessage}
              details="Örnek: Kargoya sadece [amount] kaldı!"
              required
            />
            <s-text-field
              label="Başarı metni"
              name="successMessage"
              value={formSettings.successMessage}
              required
            />
          </s-stack>
        </s-section>

        <s-section heading="Renkler">
          <s-paragraph color="subdued">
            Çubuk ve ilerleme renklerini hex kodu olarak girin (ör. #000000).
          </s-paragraph>
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Çubuk arkaplan rengi"
              name="barColor"
              value={formSettings.barColor}
              placeholder="#000000"
              required
            />
            <s-text-field
              label="İlerleme rengi"
              name="progressColor"
              value={formSettings.progressColor}
              placeholder="#22c55e"
              required
            />
          </s-stack>
        </s-section>
      </s-page>
    </fetcher.Form>
  );
}

export function ErrorBoundary() {
  return <AppRouteErrorBoundary />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
