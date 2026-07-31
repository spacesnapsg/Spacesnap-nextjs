import { NextResponse } from "next/server";
import { PasswordResetTokenInvalidError, resetPasswordWithToken } from "@/lib/password-reset";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ message: "Missing reset token." }, { status: 422 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { message: "Password must be at least 8 characters." },
      { status: 422 }
    );
  }

  try {
    await resetPasswordWithToken(token, password);
  } catch (error) {
    if (error instanceof PasswordResetTokenInvalidError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }

  return NextResponse.json({ message: "Password updated." });
}
