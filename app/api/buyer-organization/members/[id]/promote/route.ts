import { NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import {
  promoteBuyerOrgMemberDirectly,
  NotBuyerOrgAdminError,
  NotInSameOrgError,
  AlreadyBuyerOrgAdminError,
} from "@/lib/buyer-organizations";

// Admin-driven promotion — no system-admin round trip. Only reachable
// because the caller already passed requireBuyerOrgAdmin(), i.e. the org
// already has an admin; the self-service /promotion-request route is the
// only path when it doesn't.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireBuyerOrgAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;

  try {
    const user = await promoteBuyerOrgMemberDirectly(authResult.userId, id);
    return NextResponse.json({ id: user.id, isBuyerOrgAdmin: user.isBuyerOrgAdmin });
  } catch (error) {
    if (error instanceof NotInSameOrgError || error instanceof AlreadyBuyerOrgAdminError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof NotBuyerOrgAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
