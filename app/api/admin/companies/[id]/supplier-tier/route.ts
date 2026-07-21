import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { serializeAdminCompany } from "@/lib/admin-companies";
import { SupplierTier } from "@/app/generated/prisma/enums";

const SUPPLIER_TIERS = Object.values(SupplierTier);

// Admin-only manual set of Company.supplierTier — the field has existed
// since the Sprint 6 cancellation-model session (drives SupplierPayable's
// invoicingCadence, see invoicingCadenceForSupplierTier in
// lib/booking-payments.ts) but had no route to actually change it. No
// automatic gating logic here, per that session's own comment on the
// SupplierTier enum in schema.prisma — this is a manual admin decision.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const companyId = parseBigIntParam(id);
  if (companyId === null) return notFoundResponse("Company not found.");

  const body = await request.json().catch(() => null);
  const supplierTier = body && typeof body === "object" ? (body as Record<string, unknown>).supplierTier : undefined;

  if (typeof supplierTier !== "string" || !SUPPLIER_TIERS.includes(supplierTier as SupplierTier)) {
    return validationErrorResponse(
      new ApiValidationError({ supplierTier: [`supplierTier must be one of: ${SUPPLIER_TIERS.join(", ")}.`] })
    );
  }

  const existing = await prisma.company.findUnique({ where: { id: companyId } });
  if (!existing) return notFoundResponse("Company not found.");

  const company = await prisma.company.update({
    where: { id: companyId },
    data: { supplierTier: supplierTier as SupplierTier },
    include: { users: true, _count: { select: { listings: true } } },
  });

  return NextResponse.json({ company: serializeAdminCompany(company) });
}
