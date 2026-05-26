import prisma from "../db.server";

export async function getOrCreateShippingBarWidget(shop: string) {
  const existing = await prisma.shippingBarWidget.findUnique({
    where: { shop },
  });

  if (existing) {
    return existing;
  }

  return prisma.shippingBarWidget.create({ data: { shop } });
}

export async function getOrCreateStickyCartWidget(shop: string) {
  const existing = await prisma.stickyCartWidget.findUnique({
    where: { shop },
  });

  if (existing) {
    return existing;
  }

  return prisma.stickyCartWidget.create({ data: { shop } });
}

export function parseBooleanField(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on" || value === "1";
}
