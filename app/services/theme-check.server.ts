interface AdminGraphQLClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

interface ThemeAppEmbedBlock {
  type?: string;
  disabled?: boolean;
}

interface SettingsDataJson {
  current?: {
    blocks?: Record<string, ThemeAppEmbedBlock>;
  };
}

interface TemplateJson {
  sections?: Record<
    string,
    {
      blocks?: Record<string, { type?: string; disabled?: boolean }>;
    }
  >;
}

const CART_BOOSTER_EMBED_HANDLES = ["free_shipping_bar"] as const;
const CART_BOOSTER_SECTION_BLOCK_HANDLES = ["sticky_cart"] as const;

const GET_MAIN_THEME_ID = `#graphql
  query ThemeCheckMainThemeId {
    themes(first: 1, roles: [MAIN]) {
      nodes {
        id
      }
    }
  }
`;

const GET_THEME_FILES = `#graphql
  query ThemeCheckFiles($themeId: ID!) {
    theme(id: $themeId) {
      files(filenames: ["config/settings_data.json", "templates/product.json"]) {
        nodes {
          filename
          body {
            ... on OnlineStoreThemeFileBodyText {
              content
            }
          }
        }
      }
    }
  }
`;

function parseJsonFile<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    try {
      const withoutComments = content.replace(/^\s*\/\/.*$/gm, "");
      return JSON.parse(withoutComments) as T;
    } catch {
      return null;
    }
  }
}

async function getMainThemeId(graphql: AdminGraphQLClient): Promise<string | null> {
  const response = await graphql.graphql(GET_MAIN_THEME_ID);
  const json = (await response.json()) as {
    data?: { themes?: { nodes?: Array<{ id?: string }> } };
  };

  return json.data?.themes?.nodes?.[0]?.id ?? null;
}

async function getThemeFiles(
  graphql: AdminGraphQLClient,
  themeId: string,
): Promise<Map<string, string>> {
  const response = await graphql.graphql(GET_THEME_FILES, {
    variables: { themeId },
  });

  const json = (await response.json()) as {
    data?: {
      theme?: {
        files?: {
          nodes?: Array<{
            filename?: string;
            body?: { content?: string };
          }>;
        };
      };
    };
  };

  const files = new Map<string, string>();
  for (const node of json.data?.theme?.files?.nodes ?? []) {
    if (node.filename && node.body?.content) {
      files.set(node.filename, node.body.content);
    }
  }

  return files;
}

function isCartBoosterBlockType(blockType: string): boolean {
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (apiKey && blockType.includes(apiKey)) {
    return true;
  }

  return (
    blockType.includes("cart-aov-booster") ||
    blockType.includes("cart_booster") ||
    blockType.includes("aov-booster")
  );
}

function blockTypeMatchesHandle(blockType: string, handle: string): boolean {
  return (
    blockType.includes(`/blocks/${handle}/`) ||
    blockType.endsWith(`/blocks/${handle}`) ||
    blockType.includes(`/blocks/${handle}?`)
  );
}

function isBlockEnabled(disabled: boolean | undefined): boolean {
  return disabled !== true;
}

function hasEnabledEmbed(
  settingsData: SettingsDataJson,
  handle: (typeof CART_BOOSTER_EMBED_HANDLES)[number],
): boolean {
  const blocks = settingsData.current?.blocks;
  if (!blocks) {
    return false;
  }

  return Object.values(blocks).some((block) => {
    const blockType = block?.type ?? "";
    if (!isCartBoosterBlockType(blockType)) {
      return false;
    }
    if (!blockTypeMatchesHandle(blockType, handle)) {
      return false;
    }
    return isBlockEnabled(block.disabled);
  });
}

function hasEnabledSectionBlock(
  template: TemplateJson,
  handle: (typeof CART_BOOSTER_SECTION_BLOCK_HANDLES)[number],
): boolean {
  for (const section of Object.values(template.sections ?? {})) {
    for (const block of Object.values(section.blocks ?? {})) {
      const blockType = block?.type ?? "";
      if (!isCartBoosterBlockType(blockType)) {
        continue;
      }
      if (!blockTypeMatchesHandle(blockType, handle)) {
        continue;
      }
      if (isBlockEnabled(block.disabled)) {
        return true;
      }
    }
  }

  return false;
}

function hasStickyCartSectionBlock(productTemplate: TemplateJson): boolean {
  return hasEnabledSectionBlock(productTemplate, "sticky_cart");
}

export type CartBoosterThemeSetupStatus = {
  shippingBarEmbedEnabled: boolean;
  stickyCartBlockEnabled: boolean;
  isFullyConfigured: boolean;
};

export async function getCartBoosterThemeSetupStatus(
  graphql: AdminGraphQLClient,
): Promise<CartBoosterThemeSetupStatus> {
  const themeId = await getMainThemeId(graphql);
  if (!themeId) {
    return {
      shippingBarEmbedEnabled: false,
      stickyCartBlockEnabled: false,
      isFullyConfigured: false,
    };
  }

  const files = await getThemeFiles(graphql, themeId);
  const settingsContent = files.get("config/settings_data.json");
  const productTemplateContent = files.get("templates/product.json");
  let shippingBarEmbedEnabled = false;
  if (settingsContent) {
    const settingsData = parseJsonFile<SettingsDataJson>(settingsContent);
    if (settingsData) {
      shippingBarEmbedEnabled = hasEnabledEmbed(
        settingsData,
        "free_shipping_bar",
      );
    }
  }

  let stickyCartBlockEnabled = false;
  if (productTemplateContent) {
    const productTemplate = parseJsonFile<TemplateJson>(productTemplateContent);
    if (productTemplate) {
      stickyCartBlockEnabled = hasStickyCartSectionBlock(productTemplate);
    }
  }

  if (!stickyCartBlockEnabled && settingsContent) {
    const settingsData = parseJsonFile<SettingsDataJson>(settingsContent);
    if (settingsData?.current?.blocks) {
      stickyCartBlockEnabled = Object.values(settingsData.current.blocks).some(
        (block) => {
          const blockType = block?.type ?? "";
          return (
            isCartBoosterBlockType(blockType) &&
            blockTypeMatchesHandle(blockType, "sticky_cart") &&
            isBlockEnabled(block.disabled)
          );
        },
      );
    }
  }

  return {
    shippingBarEmbedEnabled,
    stickyCartBlockEnabled,
    isFullyConfigured: shippingBarEmbedEnabled && stickyCartBlockEnabled,
  };
}

/** @deprecated Use getCartBoosterThemeSetupStatus */
export async function isCartBoosterThemeExtensionEnabled(
  graphql: AdminGraphQLClient,
): Promise<boolean> {
  const status = await getCartBoosterThemeSetupStatus(graphql);
  return status.shippingBarEmbedEnabled;
}

export function buildAppEmbedDeepLinkUrl(
  shop: string,
  blockHandle = "free_shipping_bar",
  template = "index",
): string | null {
  const apiKey = process.env.SHOPIFY_API_KEY;

  if (!apiKey || !shop) {
    return null;
  }

  const params = new URLSearchParams({
    context: "apps",
    template,
    activateAppId: `${apiKey}/${blockHandle}`,
  });

  return `https://${shop}/admin/themes/current/editor?${params.toString()}`;
}

export function buildAppBlockDeepLinkUrl(
  shop: string,
  blockHandle = "sticky_cart",
  template = "product",
): string | null {
  const apiKey = process.env.SHOPIFY_API_KEY;

  if (!apiKey || !shop) {
    return null;
  }

  const params = new URLSearchParams({
    template,
    addAppBlockId: `${apiKey}/${blockHandle}`,
  });

  return `https://${shop}/admin/themes/current/editor?${params.toString()}`;
}
