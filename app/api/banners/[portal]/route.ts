import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse, notFoundResponse } from "@/lib/api-errors";
import { getActiveBanner, parseBannerPortal } from "@/lib/banners";

// Public-to-any-signed-in-user read of a portal's active (non-expired)
// banner — null means "don't render a banner", not an error.
export async function GET(request: Request, { params }: { params: Promise<{ portal: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { portal } = await params;
  const parsed = parseBannerPortal(portal);
  if (parsed === null) return notFoundResponse("Unknown portal.");

  const banner = await getActiveBanner(parsed);
  return NextResponse.json({ banner });
}
