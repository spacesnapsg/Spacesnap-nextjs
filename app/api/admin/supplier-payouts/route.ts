import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import {
  listCompaniesWithPendingPayables,
  listPayoutsAwaitingPayment,
  createSupplierPayout,
  serializeAdminSupplierPayout,
  SupplierPayoutError,
} from "@/lib/supplier-payouts";

// System-admin-only. Backs the "Supplier Payouts" card on the admin
// Financials page — companies with an un-batched pending balance ("Ready to
// Bill") plus batches already billed but not yet confirmed paid ("Awaiting
// Payment").
export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const [pendingCompanies, awaitingPayment] = await Promise.all([
    listCompaniesWithPendingPayables(),
    listPayoutsAwaitingPayment(),
  ]);

  return NextResponse.json({ pendingCompanies, awaitingPayment });
}

// System-admin-only. Closes a payout period for one company (see
// createSupplierPayout, lib/supplier-payouts.ts).
export async function POST(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return validationErrorResponse(new ApiValidationError({ body: ["Request body must be an object."] }));
  }

  try {
    const payout = await createSupplierPayout(body as Record<string, unknown>);
    const withCompany = await prisma.supplierPayout.findUniqueOrThrow({
      where: { id: payout.id },
      include: { company: { select: { name: true } } },
    });
    return NextResponse.json({ payout: serializeAdminSupplierPayout(withCompany) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof SupplierPayoutError) {
      return validationErrorResponse(new ApiValidationError({ companyId: [error.message] }));
    }
    throw error;
  }
}
