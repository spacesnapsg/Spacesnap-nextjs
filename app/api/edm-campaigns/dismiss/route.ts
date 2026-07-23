import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse } from "@/lib/api-errors";
import { dismissEdmCampaign } from "@/lib/edm-campaigns";

export async function PATCH() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  await dismissEdmCampaign(session.user.id);
  return NextResponse.json({ ok: true });
}
