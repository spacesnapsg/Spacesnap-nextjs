import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import {
  promoteMemberDirectly,
  NotCompanyAdminError,
  TargetNotInCompanyError,
  AlreadyCompanyAdminError,
} from "@/lib/promotions";

// Admin-driven promotion — no system-admin round trip. New capability,
// 2026-07-23, alongside the self-service /api/promotion-request path (which
// now only works when the company has no admin at all).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const user = await promoteMemberDirectly(auth.userId, id);
    return NextResponse.json({ id: user.id, isCompanyAdmin: user.isCompanyAdmin });
  } catch (error) {
    if (error instanceof TargetNotInCompanyError || error instanceof AlreadyCompanyAdminError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof NotCompanyAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
