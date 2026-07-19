// The fixed "required for" taxonomy for certificates — what aspect of a
// listing a certificate governs. Mirrors the categories already used for
// supplier tutorial videos (lib/mockTutorials.ts VIDEO_CATEGORIES).
export const CERTIFICATE_CATEGORIES = ["Safety", "House Rules", "Equipment", "Techniques"] as const;

export type CertificateCategory = (typeof CERTIFICATE_CATEGORIES)[number];

export function normalizeCertificateCategory(value: string): CertificateCategory | null {
  const match = CERTIFICATE_CATEGORIES.find((c) => c.toLowerCase() === value.trim().toLowerCase());
  return match ?? null;
}
