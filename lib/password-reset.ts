import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Reuses the Auth.js adapter's VerificationToken model (identifier/token/
// expires) instead of adding a new one — this app only ever configured the
// Credentials provider, so that table has sat completely unused. identifier
// = the user's email, token = the emailed one-time secret.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export class PasswordResetTokenInvalidError extends Error {
  constructor() {
    super("This reset link is invalid or has expired.");
    this.name = "PasswordResetTokenInvalidError";
  }
}

// TODO(email-provider): once a real email provider is wired up (see
// Audit-LeftoverSprint.md), this should stop returning the raw resetUrl to
// the caller — the API route currently surfaces it directly in the response
// as a stand-in for actually emailing it, purely so the flow is testable
// end-to-end before that infra exists.
export async function createPasswordResetToken(
  email: string
): Promise<{ resetUrl: string } | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return null;

  // Only one live reset link per account at a time — an old, unused link
  // shouldn't stay valid after a newer one was requested.
  await prisma.verificationToken.deleteMany({ where: { identifier: normalizedEmail } });

  const token = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token,
      expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  return { resetUrl: `/reset-password?token=${token}` };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const record = await prisma.verificationToken.findFirst({ where: { token } });
  if (!record || record.expires < new Date()) {
    throw new PasswordResetTokenInvalidError();
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Delete-then-update rather than a single transaction: if the user row
  // somehow no longer exists the token is still burned, which is the safer
  // failure mode for a one-time secret.
  await prisma.verificationToken.deleteMany({ where: { identifier: record.identifier, token } });
  await prisma.user.update({
    where: { email: record.identifier },
    data: { password: hashedPassword },
  });
}
