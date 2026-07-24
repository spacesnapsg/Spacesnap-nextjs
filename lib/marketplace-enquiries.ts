import { MarketplaceEnquiryStatus, MarketplaceEnquiryType, type MarketplaceEnquiry } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";

export class MarketplaceEnquiryResolutionError extends Error {
  constructor(public readonly reason: "not_found" | "not_pending") {
    super(
      reason === "not_found"
        ? "This enquiry does not exist."
        : "This enquiry has already been fulfilled."
    );
  }
}

export function serializeMarketplaceEnquiry(enquiry: MarketplaceEnquiry) {
  return {
    id: enquiry.id.toString(),
    type: enquiry.type,
    details: enquiry.details,
    contactEmail: enquiry.contactEmail,
    status: enquiry.status,
    createdAt: enquiry.createdAt.toISOString(),
  };
}

export async function createMarketplaceEnquiry(
  userId: string,
  type: MarketplaceEnquiryType,
  details: string,
  contactEmail?: string | null
): Promise<MarketplaceEnquiry> {
  const trimmedDetails = details.trim();
  if (!trimmedDetails) {
    throw new ApiValidationError({ details: ["Please describe what you need."] });
  }

  return prisma.marketplaceEnquiry.create({
    data: {
      requestedByUserId: userId,
      type,
      details: trimmedDetails,
      contactEmail: contactEmail?.trim() || null,
    },
  });
}

// Admin-only. The marketplace enquiry queue on the Admin Overview page —
// membership/consultancy requests awaiting a system admin to follow up with
// the requester out-of-platform.
export async function listPendingMarketplaceEnquiries() {
  return prisma.marketplaceEnquiry.findMany({
    where: { status: MarketplaceEnquiryStatus.pending },
    orderBy: { createdAt: "asc" },
    include: { requestedBy: { select: { name: true, email: true, company: { select: { name: true } } } } },
  });
}

// Admin-only. Marks a pending enquiry as fulfilled once the admin has
// handled it out-of-platform. There's no "unfulfilled"/cancelled outcome —
// closing the review modal without acting leaves the row pending, same as
// not resolving it yet.
export async function resolveMarketplaceEnquiry(id: bigint, resolvedByUserId: string): Promise<MarketplaceEnquiry> {
  const result = await prisma.marketplaceEnquiry.updateMany({
    where: { id, status: MarketplaceEnquiryStatus.pending },
    data: { status: MarketplaceEnquiryStatus.fulfilled, resolvedByUserId, resolvedAt: new Date() },
  });

  if (result.count === 0) {
    const existing = await prisma.marketplaceEnquiry.findUnique({ where: { id } });
    throw new MarketplaceEnquiryResolutionError(existing ? "not_pending" : "not_found");
  }

  return prisma.marketplaceEnquiry.findUniqueOrThrow({ where: { id } });
}
