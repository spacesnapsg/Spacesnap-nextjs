import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
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
      },
    },
    { status: 201 }
  );
}
