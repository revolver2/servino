import { prisma } from "@/lib/server/prisma";

export async function listPricingVersions(citySlug = "toronto") {
  return prisma.pricingVersion.findMany({
    where: { citySlug },
    orderBy: { createdAt: "desc" },
    include: { rules: true, createdByAdmin: { select: { email: true } } },
  });
}

export async function getPricingVersionDetail(id: string) {
  return prisma.pricingVersion.findUnique({
    where: { id },
    include: { rules: true, createdByAdmin: { select: { email: true } } },
  });
}

export async function getActivePricingVersionSummary(citySlug = "toronto") {
  return prisma.pricingVersion.findFirst({
    where: { citySlug, status: "ACTIVE" },
    include: { rules: true },
  });
}
