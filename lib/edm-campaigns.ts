import type { AdminEdmCampaign, SupplierEdmCampaign } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/storage";

const EDM_RETRIGGER_HOURS = 6;

export function serializeAdminEdmCampaign(campaign: AdminEdmCampaign) {
  return {
    id: campaign.id.toString(),
    imageUrl: getPublicAssetUrl(campaign.imageKey),
    caption: campaign.caption,
    targetMembers: campaign.targetMembers,
    targetSuppliers: campaign.targetSuppliers,
    createdAt: campaign.createdAt.toISOString(),
  };
}

export function serializeSupplierEdmCampaign(campaign: SupplierEdmCampaign) {
  return {
    id: campaign.id.toString(),
    imageUrl: getPublicAssetUrl(campaign.imageKey),
    caption: campaign.caption,
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

export async function getAdminEdmCampaign() {
  return prisma.adminEdmCampaign.findFirst({ orderBy: { id: "desc" } });
}

// Singleton by app-layer convention — delete-then-create inside a single
// $transaction, same discipline as this codebase's other "app enforces the
// invariant, not a DB constraint" cases (see the model's own schema
// comment).
export async function setAdminEdmCampaign(params: {
  imageKey: string;
  caption: string | null;
  targetMembers: boolean;
  targetSuppliers: boolean;
  createdByUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.adminEdmCampaign.deleteMany({});
    return tx.adminEdmCampaign.create({ data: params });
  });
}

export async function getSupplierEdmCampaign(companyId: bigint) {
  return prisma.supplierEdmCampaign.findUnique({ where: { companyId } });
}

export async function setSupplierEdmCampaign(params: {
  companyId: bigint;
  imageKey: string;
  caption: string | null;
  createdByUserId: string;
}) {
  return prisma.supplierEdmCampaign.upsert({
    where: { companyId: params.companyId },
    create: params,
    update: { imageKey: params.imageKey, caption: params.caption, createdByUserId: params.createdByUserId },
  });
}

export async function dismissEdmCampaign(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { lastEdmSeenAt: new Date() } });
}

export type ActiveEdmCampaign =
  | { source: "admin"; imageUrl: string; caption: string | null }
  | { source: "supplier"; imageUrl: string; caption: string | null };

// Trigger condition, deliberately simplified and stated explicitly (see the
// sprint plan's own write-up): show the popup if lastEdmSeenAt is null OR
// at least EDM_RETRIGGER_HOURS have elapsed since it was last shown —
// checked once via this function on layout mount, not polled. This single
// condition covers both "fresh sign-in" and "idle session becomes active
// again after 6h" without needing to special-case an explicit sign-out
// event. A long-idle browser tab that's never reloaded won't re-trigger
// mid-session — an accepted simplification, not silently glossed over.
//
// Candidate selection, also a stated simplification: at most one EDM shown
// at a time. Priority: the admin campaign (if it targets this user's role)
// first; otherwise the single most-recently-updated active
// SupplierEdmCampaign across all companies (if the user isMember). True
// multi-supplier ad rotation/queuing is out of scope — the gap the real
// "Ads" catalogue purchase flow will eventually need to solve.
export async function getActiveEdmForUser(user: {
  id: string;
  isMember: boolean;
  isSupplier: boolean;
  lastEdmSeenAt: Date | null;
}): Promise<ActiveEdmCampaign | null> {
  const eligible =
    user.lastEdmSeenAt === null || Date.now() - user.lastEdmSeenAt.getTime() >= EDM_RETRIGGER_HOURS * 60 * 60 * 1000;
  if (!eligible) return null;

  const admin = await getAdminEdmCampaign();
  if (admin && ((user.isMember && admin.targetMembers) || (user.isSupplier && admin.targetSuppliers))) {
    return { source: "admin", imageUrl: getPublicAssetUrl(admin.imageKey), caption: admin.caption };
  }

  if (user.isMember) {
    const supplierCampaign = await prisma.supplierEdmCampaign.findFirst({ orderBy: { updatedAt: "desc" } });
    if (supplierCampaign) {
      return { source: "supplier", imageUrl: getPublicAssetUrl(supplierCampaign.imageKey), caption: supplierCampaign.caption };
    }
  }

  return null;
}
