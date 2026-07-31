import { NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/password-reset";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ message: "Please enter a valid email address." }, { status: 422 });
  }

  const result = await createPasswordResetToken(email);

  // Same response shape whether or not the account exists, so the message
  // itself never reveals which — only the (dev-only) resetUrl field differs.
  return NextResponse.json({
    message: "If an account exists for that email, a reset link has been generated.",
    // TODO(email-provider): stop returning resetUrl once a real email
    // provider sends it instead — see Audit-LeftoverSprint.md.
    resetUrl: result?.resetUrl ?? null,
  });
}
