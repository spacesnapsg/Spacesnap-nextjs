import { NextRequest, NextResponse } from "next/server";
import { requireSupplier, requireCompanyAdmin } from "@/lib/supplier-auth";
import { ApiValidationError, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBusinessDetailsFields, serializeCompanyDetails, updateCompanyBusinessDetails } from "@/lib/company";
import { prisma } from "@/lib/prisma";

// GET: any supplier at the company can view its business details.
export async function GET() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const company = await prisma.company.findUnique({ where: { id: auth.companyId } });
  if (!company) return notFoundResponse("Company not found.");

  return NextResponse.json({ company: serializeCompanyDetails(company) });
}

// PATCH: only a company admin can edit business/finance details. Closes the
// "no route exposes them for editing" gap tracked since Sprint 3 Session 3 —
// scoped to businessName/businessDescription/registrationNumber/
// financeContactEmail/financeContactPerson only (product owner call,
// 2026-07-20 — businessLocation/yearsOperating stay out of this form).
export async function PATCH(request: NextRequest) {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  try {
    const fields = parseBusinessDetailsFields(body);
    const company = await updateCompanyBusinessDetails(auth.companyId, fields);
    return NextResponse.json({ company: serializeCompanyDetails(company) });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
