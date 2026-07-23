import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { resolveBuyerOrgMembership, BuyerOrgJoinRequestAlreadyPendingError } from "@/lib/buyer-organizations";

// Self-service join, for a user who skipped organization selection at
// signup (or never had the option — pre-existing accounts). Same
// search-or-create resolution as the signup-time path
// (app/api/auth/register/route.ts), just authenticated instead of anonymous.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  if (session.user.buyerOrganizationId) {
    return validationErrorResponse(
      new ApiValidationError({ name: ["You already belong to an organization."] })
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";

  try {
    const result = await resolveBuyerOrgMembership(session.user.id, name);
    return NextResponse.json({ status: result.status, organization: result.organization });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof BuyerOrgJoinRequestAlreadyPendingError) {
      return validationErrorResponse(new ApiValidationError({ name: [error.message] }));
    }
    throw error;
  }
}
