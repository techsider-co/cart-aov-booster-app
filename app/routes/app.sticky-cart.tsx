import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { AppRouteErrorBoundary } from "../components/AppRouteErrorBoundary";
import prisma from "../db.server";
import { useActionToast } from "../hooks/use-action-toast";
import { syncAovMetafields } from "../services/sync-aov-metafields.server";
import {
  getOrCreateStickyCartWidget,
  parseBooleanFromFormData,
} from "../services/widget-settings.server";
import { requireProSubscription } from "../services/require-pro-subscription.server";

const POSITION_OPTIONS = [
  { value: "top", label: "Sayfanın üstünde" },
  { value: "bottom", label: "Sayfanın altında" },
] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await requireProSubscription(request);

  const settings = await getOrCreateStickyCartWidget(session.shop);

  return { settings, positionOptions: POSITION_OPTIONS };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await requireProSubscription(request);

  const formData = await request.formData();

  const position = String(formData.get("position") ?? "bottom");
  if (!POSITION_OPTIONS.some((option) => option.value === position)) {
    return {
      success: false as const,
      error: "Geçerli bir konum seçin.",
    };
  }

  try {
    await prisma.stickyCartWidget.upsert({
      where: { shop: session.shop },
      create: {
        shop: session.shop,
        isActive: parseBooleanFromFormData(formData, "isActive"),
        position,
        buttonColor: String(formData.get("buttonColor") ?? "#000000"),
        buttonText: String(formData.get("buttonText") ?? "Sepete Ekle"),
        hideOnDesktop: parseBooleanFromFormData(formData, "hideOnDesktop"),
      },
      update: {
        isActive: parseBooleanFromFormData(formData, "isActive"),
        position,
        buttonColor: String(formData.get("buttonColor") ?? "#000000"),
        buttonText: String(formData.get("buttonText") ?? "Sepete Ekle"),
        hideOnDesktop: parseBooleanFromFormData(formData, "hideOnDesktop"),
      },
    });

    await syncAovMetafields(session.shop, admin);

    const settings = await getOrCreateStickyCartWidget(session.shop);
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

type ActionData = Awaited<ReturnType<typeof action>>;

export default function StickyCartPage() {
  const { settings, positionOptions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();
  const isSaving =
    fetcher.state === "submitting" || fetcher.state === "loading";

  const formSettings =
    fetcher.data?.success === true ? fetcher.data.settings : settings;

  useActionToast({
    data: fetcher.data,
    isSuccess: (data) => data.success === true,
    successMessage: "Yapışkan sepete ekle ayarları kaydedildi.",
    getErrorMessage: (data) =>
      data.success === false ? data.error : undefined,
  });

  return (
    <fetcher.Form method="post" data-save-bar>
      <s-page heading="Sticky Add-to-Cart">
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
            Yapışkan sepete ekle butonunu ürün sayfalarında göstermek için
            etkinleştirin. Ürün şablonunda{" "}
            <s-text type="strong">Blok ekle → Sticky Add-to-Cart</s-text> bloğunu
            eklemeyi unutmayın.
          </s-paragraph>
          <s-switch
            label="Widget aktif"
            name="isActive"
            value="true"
            checked={formSettings.isActive || undefined}
          />
        </s-section>

        <s-section heading="Konum">
          <s-paragraph color="subdued">
            Butonun ekranda nerede sabitleneceğini seçin.
          </s-paragraph>
          <s-select
            label="Buton konumu"
            name="position"
            value={formSettings.position}
          >
            {positionOptions.map((option) => (
              <s-option key={option.value} value={option.value}>
                {option.label}
              </s-option>
            ))}
          </s-select>
        </s-section>

        <s-section heading="Tasarım">
          <s-paragraph color="subdued">
            Butonun görünümünü mağazanıza uygun şekilde özelleştirin.
          </s-paragraph>
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Buton rengi"
              name="buttonColor"
              value={formSettings.buttonColor}
              placeholder="#000000"
              required
            />
            <s-text-field
              label="Buton metni"
              name="buttonText"
              value={formSettings.buttonText}
              placeholder="Sepete Ekle"
              required
            />
          </s-stack>
        </s-section>

        <s-section heading="Hedefleme">
          <s-paragraph color="subdued">
            Butonu yalnızca mobil cihazlarda göstermek için masaüstünde gizleyin.
          </s-paragraph>
          <s-checkbox
            label="Masaüstünde gizle (sadece mobilde göster)"
            name="hideOnDesktop"
            value="true"
            checked={formSettings.hideOnDesktop || undefined}
          />
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
