import { NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import {
  removeBuyerOrgMember,
  NotBuyerOrgAdminError,
  CannotRemoveSelfError,
  NotInSameOrgError,
} from "@/lib/buyer-organizations";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireBuyerOrgAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;

  try {
    await removeBuyerOrgMember(authResult.userId, id);
    return NextResponse.json({ removed: true });
  } catch (error) {
    if (error instanceof CannotRemoveSelfError || error instanceof NotInSameOrgError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof NotBuyerOrgAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
