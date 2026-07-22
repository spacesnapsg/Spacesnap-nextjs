import { ActivityActionType, type ActivityLog, type Listing, type TrainingSession } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";

const ACTION_TYPE_VALUES = new Set<string>(Object.values(ActivityActionType));

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export interface ActivityQuery {
  types: ActivityActionType[] | null;
  since: Date | null;
  limit: number;
}

// GET-only filters (types/days/limit) — the write side (every `activityLog.create`
// call across lib/bookings.ts, lib/bulk-orders.ts, etc.) is untouched by this
// module. `days` maps to the dashboard's "past 7 days / past 30 days / past
// quarter" pills; omitting it means all-time, same as omitting `types` means
// every action type.
export function parseActivityQuery(searchParams: URLSearchParams): ActivityQuery {
  const errors: Record<string, string[]> = {};

  let types: ActivityActionType[] | null = null;
  const rawTypes = searchParams.get("types");
  if (rawTypes) {
    const requested = rawTypes.split(",").map((t) => t.trim()).filter(Boolean);
    const invalid = requested.filter((t) => !ACTION_TYPE_VALUES.has(t));
    if (invalid.length > 0) {
      errors.types = [`Unknown activity type(s): ${invalid.join(", ")}.`];
    } else {
      types = requested as ActivityActionType[];
    }
  }

  let since: Date | null = null;
  const rawDays = searchParams.get("days");
  if (rawDays) {
    const days = Number(rawDays);
    if (!Number.isInteger(days) || days <= 0) {
      errors.days = ["days must be a positive integer."];
    } else {
      since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }
  }

  let limit = DEFAULT_LIMIT;
  const rawLimit = searchParams.get("limit");
  if (rawLimit) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      errors.limit = ["limit must be a positive integer."];
    } else {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return { types, since, limit };
}

export async function getUserActivity(userId: string, query: ActivityQuery) {
  return prisma.activityLog.findMany({
    where: {
      userId,
      ...(query.types ? { actionType: { in: query.types } } : {}),
      ...(query.since ? { createdAt: { gte: query.since } } : {}),
    },
    include: {
      listing: { select: { name: true } },
      trainingSession: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
  });
}

type ActivityLogWithRelations = ActivityLog & {
  listing: Pick<Listing, "name"> | null;
  trainingSession: Pick<TrainingSession, "title"> | null;
};

export function serializeActivityLogEntry(entry: ActivityLogWithRelations) {
  return {
    id: entry.id.toString(),
    actionType: entry.actionType,
    description: entry.description,
    relatedListingId: entry.relatedListingId?.toString() ?? null,
    listingName: entry.listing?.name ?? null,
    relatedTrainingSessionId: entry.relatedTrainingSessionId?.toString() ?? null,
    trainingSessionTitle: entry.trainingSession?.title ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}
