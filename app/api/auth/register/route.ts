import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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

// Mirrors the old Laravel AuthController@register contract (name/email/password
// only — no role/company field, see CODEBASEAPI_SUMMARY.md §3): create the
// user and return 201, no session. Hashing via bcryptjs (10 rounds) to match
// Laravel's Hash::make default (bcrypt, 10 rounds).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

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
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, referralCode, referredByUserId },
  });

  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSupplier: user.isSupplier,
        isCompanyAdmin: user.isCompanyAdmin,
        isSystemAdmin: user.isSystemAdmin,
        companyId: user.companyId ? user.companyId.toString() : null,
        referralCode: user.referralCode,
      },
    },
    { status: 201 }
  );
}
