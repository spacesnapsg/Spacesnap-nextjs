import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { notFoundResponse } from "@/lib/api-errors";
import {
  declineCompanyBoostRequest,
  serializeCompanyBoostRequest,
  getCompanyBoostRequestById,
  CompanyBoostRequestNotFoundError,
  CompanyBoostRequestNotPendingError,
} from "@/lib/company-boost-requests";
import { NotCompanyAdminError } from "@/lib/company-membership";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireCompanyAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: "Invalid request id." }, { status: 422 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = typeof (body as Record<string, unknown>)?.reason === "string" ? (body as Record<string, string>).reason : undefined;

  try {
    await declineCompanyBoostRequest(authResult.userId, BigInt(id), reason);
    const full = await getCompanyBoostRequestById(BigInt(id));
    return NextResponse.json({ request: serializeCompanyBoostRequest(full!) });
  } catch (error) {
    if (error instanceof CompanyBoostRequestNotFoundError) return notFoundResponse(error.message);
    if (error instanceof CompanyBoostRequestNotPendingError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof NotCompanyAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
