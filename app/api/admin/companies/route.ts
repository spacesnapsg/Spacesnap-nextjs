import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { serializeAdminCompany } from "@/lib/admin-companies";
import { getCompanySupplierTier } from "@/lib/supplier-tiers";

// Platform-wide company list with nested member/listing data — closes the
// "no GET /api/admin/companies" gap tracked since Sprint 3 Session 4.
export async function GET(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  const where: Prisma.CompanyWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { businessName: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const companies = await prisma.company.findMany({
    where,
    include: {
      users: true,
      _count: { select: { listings: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const tiers = await Promise.all(companies.map((company) => getCompanySupplierTier(company.id)));

  return NextResponse.json({
    companies: companies.map((company, i) => serializeAdminCompany(company, tiers[i].tier)),
    meta: { total: companies.length },
  });
}
