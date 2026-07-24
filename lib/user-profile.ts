import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";

// Backs the Digital Passport and Supplier Profile "Edit Profile" cards —
// both previously fake-saved local-only edits with no backend at all
// (2026-07-24 pre-UAT audit finding). avatarUrl is stored as-is (a data:
// URI from the existing FileReader-based picker on both pages) — no R2
// upload here, matching the pre-existing client-side behavior this fix
// wires up, not a new upload pipeline.
export async function updateUserProfile(
  userId: string,
  input: { name: string; title: string | null; avatarUrl: string | null }
) {
  const name = input.name.trim();
  if (!name) {
    throw new ApiValidationError({ name: ["Name is required."] });
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      name,
      title: input.title?.trim() || null,
      avatarUrl: input.avatarUrl || null,
    },
  });
}
