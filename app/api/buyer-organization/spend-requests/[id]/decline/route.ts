import { NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { notFoundResponse } from "@/lib/api-errors";
import {
  declineBuyerOrgSpendRequest,
  serializeBuyerOrgSpendRequest,
  getBuyerOrgSpendRequestById,
  BuyerOrgSpendRequestNotFoundError,
  BuyerOrgSpendRequestNotPendingError,
} from "@/lib/buyer-org-spend-requests";
import { NotBuyerOrgAdminError } from "@/lib/buyer-organizations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireBuyerOrgAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: "Invalid request id." }, { status: 422 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = typeof (body as Record<string, unknown>)?.reason === "string" ? (body as Record<string, string>).reason : undefined;

  try {
    await declineBuyerOrgSpendRequest(authResult.userId, BigInt(id), reason);
    const full = await getBuyerOrgSpendRequestById(BigInt(id));
    return NextResponse.json({ request: serializeBuyerOrgSpendRequest(full!) });
  } catch (error) {
    if (error instanceof BuyerOrgSpendRequestNotFoundError) return notFoundResponse(error.message);
    if (error instanceof BuyerOrgSpendRequestNotPendingError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof NotBuyerOrgAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
