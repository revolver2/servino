import { prisma } from "@/lib/server/prisma";

/** The professional's own profile — read-only for now (D-numbered decisions keep identity/verification admin-controlled, see docs/DECISIONS.md and spec section 40). */
export async function getOwnProfessionalProfile(professionalId: string) {
  return prisma.professional.findUnique({
    where: { id: professionalId },
    include: { services: true },
  });
}
