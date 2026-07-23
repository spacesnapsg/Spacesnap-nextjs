import { auth } from "@/auth";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/api-errors";

// Mirrors lib/supplier-auth.ts's requireSupplier()/requireCompanyAdmin() pair,
// scoped to BuyerOrganization instead of Company. No middleware.ts/route-group
// guard exists yet in this rewrite (same standing gap noted in supplier-auth.ts),
// so each buyer-org route checks this itself.
export async function requireBuyerOrgMember() {
  const session = await auth();
  if (!session?.user) {
    return { error: unauthorizedResponse() } as const;
  }
  if (!session.user.buyerOrganizationId) {
    return { error: forbiddenResponse("Your account is not associated with an organization.") } as const;
  }

  return {
    buyerOrganizationId: BigInt(session.user.buyerOrganizationId),
    userId: session.user.id,
  } as const;
}

export async function requireBuyerOrgAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { error: unauthorizedResponse() } as const;
  }
  if (!session.user.isBuyerOrgAdmin) {
    return { error: forbiddenResponse("This action requires organization admin access.") } as const;
  }
  if (!session.user.buyerOrganizationId) {
    return { error: forbiddenResponse("Your account is not associated with an organization.") } as const;
  }

  return {
    buyerOrganizationId: BigInt(session.user.buyerOrganizationId),
    userId: session.user.id,
  } as const;
}
