// app/routes/app.shipping-bar.tsx

import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useState, useCallback, useRef } from "react";

import { AppRouteErrorBoundary } from "../components/AppRouteErrorBoundary";
import prisma from "../db.server";
import { useActionToast } from "../hooks/use-action-toast";
import { syncAovMetafields } from "../services/sync-aov-metafields.server";
import {
  getOrCreateShippingBarWidget,
  parseBooleanFromFormData,
} from "../services/widget-settings.server";
import { requireProSubscription } from "../services/require-pro-subscription.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

const CURRENCY_OPTIONS = ["TRY", "USD", "EUR", "GBP"] as const;

const FONT_FAMILY_OPTIONS = [
  { value: "inherit", label: "Tema varsayılanı" },
  { value: "arial", label: "Arial" },
  { value: "times", label: "Times New Roman" },
  { value: "georgia", label: "Georgia" },
  { value: "verdana", label: "Verdana" },
  { value: "trebuchet", label: "Trebuchet MS" },
  { value: "roboto", label: "Roboto" },
  { value: "open_sans", label: "Open Sans" },
  { value: "lato", label: "Lato" },
  { value: "montserrat", label: "Montserrat" },
  { value: "poppins", label: "Poppins" },
] as const;

// ─── Preset background images ────────────────────────────────────────────────
// CDN-hosted images sized ~1200×80px (banner aspect). Replace URLs with your
// own CDN paths once hosted.
export const PRESET_BACKGROUNDS = [
  {
    id: "none",
    label: "Yok (düz renk)",
    thumbnail: null,
    url: null,
  },
  {
    id: "gradient-warm",
    label: "Sıcak Gradyan",
    thumbnail:
      "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=200&h=40&fit=crop",
    url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1400&h=100&fit=crop",
  },
  {
    id: "gradient-ocean",
    label: "Okyanus",
    thumbnail:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&h=40&fit=crop",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1400&h=100&fit=crop",
  },
  {
    id: "gradient-forest",
    label: "Orman",
    thumbnail:
      "https://images.unsplash.com/photo-1448375240586-882707db888b?w=200&h=40&fit=crop",
    url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1400&h=100&fit=crop",
  },
  {
    id: "gradient-sunset",
    label: "Günbatımı",
    thumbnail:
      "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=200&h=40&fit=crop",
    url: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1400&h=100&fit=crop",
  },
  {
    id: "gradient-night",
    label: "Gece",
    thumbnail:
      "https://images.unsplash.com/photo-1436891678271-9c672565d8f6?w=200&h=40&fit=crop",
    url: "https://images.unsplash.com/photo-1436891678271-9c672565d8f6?w=1400&h=100&fit=crop",
  },
] as const;

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await requireProSubscription(request);
  const settings = await getOrCreateShippingBarWidget(session.shop);
  return {
    settings,
    currencyOptions: CURRENCY_OPTIONS,
    fontFamilyOptions: FONT_FAMILY_OPTIONS,
    presetBackgrounds: PRESET_BACKGROUNDS,
  };
};

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await requireProSubscription(request);
  const formData = await request.formData();

  const goalAmountRaw = formData.get("goalAmount");
  const goalAmount = Number(goalAmountRaw);
  const barHeight = Number(formData.get("barHeight"));
  const fontSize = Number(formData.get("fontSize"));
  const trackHeight = Number(formData.get("trackHeight"));

  if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
    return { success: false as const, error: "Geçerli bir hedef tutar girin." };
  }
  if (!Number.isFinite(barHeight) || barHeight < 40 || barHeight > 120) {
    return {
      success: false as const,
      error: "Çubuk yüksekliği 40–120 px arasında olmalıdır.",
    };
  }
  if (!Number.isFinite(fontSize) || fontSize < 12 || fontSize > 28) {
    return {
      success: false as const,
      error: "Yazı boyutu 12–28 px arasında olmalıdır.",
    };
  }
  if (!Number.isFinite(trackHeight) || trackHeight < 4 || trackHeight > 16) {
    return {
      success: false as const,
      error: "İlerleme çubuğu kalınlığı 4–16 px arasında olmalıdır.",
    };
  }

  try {
    await prismaUpdateShippingBar(session.shop, formData, {
      goalAmount,
      barHeight,
      fontSize,
      trackHeight,
    });
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
  numbers: {
    goalAmount: number;
    barHeight: number;
    fontSize: number;
    trackHeight: number;
  },
) {
  const backgroundImageUrl = String(
    formData.get("backgroundImageUrl") ?? "",
  ).trim();

  const payload = {
    isActive: parseBooleanFromFormData(formData, "isActive"),
    goalAmount: numbers.goalAmount,
    currency: String(formData.get("currency") ?? "TRY"),
    initialMessage: String(formData.get("initialMessage") ?? ""),
    progressMessage: String(formData.get("progressMessage") ?? ""),
    successMessage: String(formData.get("successMessage") ?? ""),
    barColor: String(formData.get("barColor") ?? "#000000"),
    progressColor: String(formData.get("progressColor") ?? "#22c55e"),
    textColor: String(formData.get("textColor") ?? "#ffffff"),
    trackColor: String(formData.get("trackColor") ?? "#ffffff40"),
    barHeight: numbers.barHeight,
    fontSize: numbers.fontSize,
    fontFamily: String(formData.get("fontFamily") ?? "inherit"),
    trackHeight: numbers.trackHeight,
    // new field — empty string means "no image"
    backgroundImageUrl,
  };

  return prisma.shippingBarWidget.upsert({
    where: { shop },
    create: { shop, ...payload },
    update: payload,
  });
}

type ActionData = Awaited<ReturnType<typeof action>>;

// ─── Color picker component ───────────────────────────────────────────────────

/**
 * A compound color input: native <input type="color"> swatch next to a hex
 * text field. Works inside a Shopify s-* web-component form because it renders
 * standard <input> elements whose values are picked up by FormData.
 *
 * The hidden <input name={name}> is what actually gets submitted; the color
 * swatch and the hex text field are both kept in sync via local state.
 */
function ColorPicker({
  label,
  name,
  value,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
}) {
  const [color, setColor] = useState(value || "#000000");
  const textRef = useRef<HTMLInputElement>(null);

  const handleSwatch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value);
    if (textRef.current) textRef.current.value = e.target.value;
  }, []);

  const handleText = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    setColor(v);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <label
        style={{
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--p-color-text)",
        }}
      >
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {/* Swatch */}
        <input
          type="color"
          value={color.length === 7 && color.startsWith("#") ? color : "#000000"}
          onChange={handleSwatch}
          style={{
            width: 40,
            height: 40,
            padding: 2,
            border: "1px solid var(--p-color-border)",
            borderRadius: 8,
            cursor: "pointer",
            background: "none",
            flexShrink: 0,
          }}
          aria-label={`${label} renk seçici`}
        />
        {/* Hex text — also the form field */}
        <input
          ref={textRef}
          type="text"
          name={name}
          defaultValue={color}
          onChange={handleText}
          placeholder={placeholder ?? "#000000"}
          maxLength={9}
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            border: "1px solid var(--p-color-border)",
            borderRadius: 8,
            fontSize: "0.875rem",
            fontFamily: "monospace",
            background: "var(--p-color-bg-surface)",
            color: "var(--p-color-text)",
            outline: "none",
          }}
          aria-label={`${label} hex değeri`}
        />
        {/* Live preview swatch */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            border: "1px solid var(--p-color-border)",
            background: color,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

// ─── Background image picker ──────────────────────────────────────────────────

function BackgroundImagePicker({
  presets,
  currentUrl,
}: {
  presets: typeof PRESET_BACKGROUNDS;
  currentUrl: string;
}) {
  const [selected, setSelected] = useState<string>(
    () =>
      presets.find((p) => p.url === currentUrl)?.id ??
      (currentUrl ? "custom" : "none"),
  );
  const [customUrl, setCustomUrl] = useState(
    () =>
      presets.find((p) => p.url === currentUrl) ? "" : currentUrl,
  );

  const activeUrl =
    selected === "none"
      ? ""
      : selected === "custom"
        ? customUrl
        : (presets.find((p) => p.id === selected)?.url ?? "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Hidden field that gets submitted */}
      <input type="hidden" name="backgroundImageUrl" value={activeUrl} />

      <label
        style={{
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--p-color-text)",
        }}
      >
        Arka plan görseli
      </label>

      {/* Preset grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: "0.5rem",
        }}
      >
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setSelected(preset.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.5rem",
              border:
                selected === preset.id
                  ? "2px solid var(--p-color-border-emphasis)"
                  : "2px solid var(--p-color-border)",
              borderRadius: 10,
              background:
                selected === preset.id
                  ? "var(--p-color-bg-surface-selected)"
                  : "var(--p-color-bg-surface)",
              cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s",
            }}
            aria-pressed={selected === preset.id}
            aria-label={preset.label}
          >
            {preset.thumbnail ? (
              <img
                src={preset.thumbnail}
                alt={preset.label}
                style={{
                  width: "100%",
                  height: 32,
                  objectFit: "cover",
                  borderRadius: 6,
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 32,
                  borderRadius: 6,
                  background:
                    "repeating-linear-gradient(45deg,#ccc 0,#ccc 4px,#fff 4px,#fff 8px)",
                }}
              />
            )}
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--p-color-text-secondary)",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {preset.label}
            </span>
          </button>
        ))}

        {/* Custom URL option */}
        <button
          type="button"
          onClick={() => setSelected("custom")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.5rem",
            border:
              selected === "custom"
                ? "2px solid var(--p-color-border-emphasis)"
                : "2px solid var(--p-color-border)",
            borderRadius: 10,
            background:
              selected === "custom"
                ? "var(--p-color-bg-surface-selected)"
                : "var(--p-color-bg-surface)",
            cursor: "pointer",
            transition: "border-color 0.15s, background 0.15s",
          }}
          aria-pressed={selected === "custom"}
          aria-label="Özel URL"
        >
          <div
            style={{
              width: "100%",
              height: 32,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--p-color-bg-surface-secondary)",
              fontSize: "1.2rem",
            }}
          >
            🔗
          </div>
          <span
            style={{
              fontSize: "0.7rem",
              color: "var(--p-color-text-secondary)",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            Özel URL
          </span>
        </button>
      </div>

      {/* Custom URL input */}
      {selected === "custom" && (
        <input
          type="url"
          placeholder="https://example.com/banner.jpg"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          style={{
            padding: "0.5rem 0.75rem",
            border: "1px solid var(--p-color-border)",
            borderRadius: 8,
            fontSize: "0.875rem",
            background: "var(--p-color-bg-surface)",
            color: "var(--p-color-text)",
            outline: "none",
          }}
          aria-label="Özel görsel URL'si"
        />
      )}

      {/* Live preview */}
      {activeUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--p-color-text-secondary)",
            }}
          >
            Önizleme
          </span>
          <div
            style={{
              height: 56,
              borderRadius: 8,
              backgroundImage: `url(${activeUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: "1px solid var(--p-color-border)",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function ShippingBarPage() {
  const { settings, currencyOptions, fontFamilyOptions, presetBackgrounds } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();
  const isSaving =
    fetcher.state === "submitting" || fetcher.state === "loading";

  const formSettings =
    fetcher.data?.success === true ? fetcher.data.settings : settings;

  useActionToast({
    data: fetcher.data,
    isSuccess: (data) => data.success === true,
    successMessage:
      "Kargo çubuğu ayarları kaydedildi ve mağazaya senkronize edildi.",
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

        {/* ── Info banner ── */}
        <s-section>
          <s-banner tone="info" heading="Tema editörü = yalnızca açma/kapama">
            <s-paragraph>
              Renk, metin ve hedef ayarlarını buradan yapın. Shopify Tema
              Editöründe{" "}
              <s-text type="strong">
                Uygulama eklemeleri → Shipping Bar
              </s-text>{" "}
              şalterini yalnızca mağazada göstermek için kullanın.
            </s-paragraph>
          </s-banner>
        </s-section>

        {/* ── Status ── */}
        <s-section heading="Durum">
          <s-paragraph color="subdued">
            Widget&apos;ı mağazada göstermek için etkinleştirin ve kaydedin.
          </s-paragraph>
          <s-switch
            label="Widget aktif"
            name="isActive"
            value="true"
            checked={formSettings.isActive || undefined}
          />
        </s-section>

        {/* ── Goal ── */}
        <s-section heading="Hedef">
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

        {/* ── Messages ── */}
        <s-section heading="Metinler">
          <s-paragraph color="subdued">
            İlerleme metninde{" "}
            <s-text type="strong">[amount]</s-text> kalan tutarı gösterir.
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

        {/* ── Appearance ── */}
        <s-section heading="Görünüm">
          <s-stack direction="block" gap="base">
            <s-number-field
              label="Çubuk yüksekliği (px)"
              name="barHeight"
              value={String(formSettings.barHeight)}
              min={40}
              max={120}
              step={4}
              required
            />
            <s-number-field
              label="Yazı boyutu (px)"
              name="fontSize"
              value={String(formSettings.fontSize)}
              min={12}
              max={28}
              step={1}
              required
            />
            <s-select
              label="Yazı tipi"
              name="fontFamily"
              value={formSettings.fontFamily}
            >
              {fontFamilyOptions.map((font) => (
                <s-option key={font.value} value={font.value}>
                  {font.label}
                </s-option>
              ))}
            </s-select>
            <s-number-field
              label="İlerleme çubuğu kalınlığı (px)"
              name="trackHeight"
              value={String(formSettings.trackHeight)}
              min={4}
              max={16}
              step={1}
              required
            />
          </s-stack>
        </s-section>

        {/* ── Colors — with color pickers ── */}
        <s-section heading="Renkler">
          <s-stack direction="block" gap="base">
            <ColorPicker
              label="Arka plan rengi"
              name="barColor"
              value={formSettings.barColor}
              placeholder="#000000"
            />
            <ColorPicker
              label="Metin rengi"
              name="textColor"
              value={formSettings.textColor}
              placeholder="#ffffff"
            />
            <ColorPicker
              label="İlerleme dolgu rengi"
              name="progressColor"
              value={formSettings.progressColor}
              placeholder="#22c55e"
            />
            <ColorPicker
              label="İlerleme çubuğu arka planı"
              name="trackColor"
              value={formSettings.trackColor}
              placeholder="#ffffff40"
            />
          </s-stack>
        </s-section>

        {/* ── Background image ── */}
        <s-section heading="Arka Plan Görseli">
          <s-paragraph color="subdued">
            Düz renk yerine bir görsel kullanmak isterseniz aşağıdan seçin ya
            da kendi görsel URL&apos;nizi girin. Görsel seçildiğinde arka plan
            rengi üzerine overlay olarak uygulanır; metin okunabilirliği için
            arka plan rengini de ayarlayabilirsiniz.
          </s-paragraph>
          <BackgroundImagePicker
            presets={presetBackgrounds}
            currentUrl={(formSettings as any).backgroundImageUrl ?? ""}
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