import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { removeCompanyMember, NotCompanyAdminError, CannotRemoveSelfError, NotInSameCompanyError } from "@/lib/company-membership";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    await removeCompanyMember(auth.userId, id);
    return NextResponse.json({ removed: true });
  } catch (error) {
    if (error instanceof CannotRemoveSelfError || error instanceof NotInSameCompanyError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof NotCompanyAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
