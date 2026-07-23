import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resolveBuyerOrgMembership } from "@/lib/buyer-organizations";
import { resolveCompanyMembership } from "@/lib/company-membership";
import { parseSignupRole, resolveIsMember } from "@/lib/signup-roles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sprint 6.5 — User Reward Tier referral mechanic. Every user gets their own
// shareable code at registration; collisions are astronomically unlikely
// (8 hex chars = 4.3 billion combinations) but not silently assumed away —
// retried a bounded number of times against the unique constraint rather
// than left to crash the request.
const REFERRAL_CODE_ATTEMPTS = 5;

async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < REFERRAL_CODE_ATTEMPTS; attempt++) {
    const code = randomBytes(4).toString("hex");
    const existing = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique referral code after several attempts.");
}

// Originally mirrored the old Laravel AuthController@register contract
// (name/email/password only — no role/company field, see
// CODEBASEAPI_SUMMARY.md §3). 2026-07-23 (Sprint 6.10 follow-on): the signup
// page's role/company fields were always collected client-side but never
// sent here — dead UI, flagged and closed as part of the Buyer Organization
// build (see SPRINT_PLAN_NEXTJS_REWRITE.md "Sprint 7.1"). Now: role="member"
// resolves buyerOrganizationName against BuyerOrganization, role="supplier"
// resolves companyName against Company, role="both" resolves both. Hashing
// via bcryptjs (10 rounds) to match Laravel's Hash::make default.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = parseSignupRole(body?.role);
  const buyerOrganizationName =
    typeof body?.buyerOrganizationName === "string" ? body.buyerOrganizationName.trim() : "";
  const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";

  if (!name || !email || !password) {
    return NextResponse.json(
      { message: "Name, email, and password are required." },
      { status: 422 }
    );
  }
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { message: "Please enter a valid email address." },
      { status: 422 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { message: "Password must be at least 8 characters." },
      { status: 422 }
    );
  }
  if ((role === "supplier" || role === "both") && !companyName) {
    return NextResponse.json(
      { message: "Company name is required for a supplier account." },
      { status: 422 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { message: "An account with this email already exists." },
      { status: 422 }
    );
  }

  // Sprint 6.5 — User Reward Tier referral mechanic. A typo'd/unknown code
  // should surface as a validation error, not be silently dropped — the user
  // would otherwise believe they successfully referred someone.
  const rawReferralCode = typeof body?.referralCode === "string" ? body.referralCode.trim() : "";
  let referredByUserId: string | null = null;
  if (rawReferralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: rawReferralCode } });
    if (!referrer) {
      return NextResponse.json(
        { message: "That referral code doesn't match any account." },
        { status: 422 }
      );
    }
    referredByUserId = referrer.id;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const referralCode = await generateUniqueReferralCode();
  let user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      referralCode,
      referredByUserId,
      isMember: resolveIsMember(role),
    },
  });

  // Org resolution happens after the account exists (resolveBuyerOrgMembership/
  // resolveCompanyMembership both need a real userId to seat or queue). Not
  // wrapped in one giant transaction with the user create above — same
  // "each step owns its own atomicity" posture the rest of this codebase
  // already takes (e.g. booking create vs. its own debit transaction).
  const organizationResults: {
    buyerOrganization?: { status: "joined" | "pending"; name: string };
    company?: { status: "joined" | "pending"; name: string };
  } = {};

  if ((role === "member" || role === "both") && buyerOrganizationName) {
    const result = await resolveBuyerOrgMembership(user.id, buyerOrganizationName);
    organizationResults.buyerOrganization = { status: result.status, name: result.organization.name };
  }

  if ((role === "supplier" || role === "both") && companyName) {
    const result = await resolveCompanyMembership(user.id, companyName);
    organizationResults.company = { status: result.status, name: result.company.name };
  }

  if (organizationResults.buyerOrganization || organizationResults.company) {
    user = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSupplier: user.isSupplier,
        isMember: user.isMember,
        isCompanyAdmin: user.isCompanyAdmin,
        isSystemAdmin: user.isSystemAdmin,
        companyId: user.companyId ? user.companyId.toString() : null,
        buyerOrganizationId: user.buyerOrganizationId ? user.buyerOrganizationId.toString() : null,
        referralCode: user.referralCode,
      },
      organizationResults,
    },
    { status: 201 }
  );
}
