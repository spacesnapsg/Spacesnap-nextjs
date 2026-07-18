import type { DefaultSession } from "next-auth";

// Role is derived from three booleans on `users`, not a single role column —
// see the note on the Prisma User model. Session/JWT carry the same shape so
// the frontend can role-gate without an extra round trip.
declare module "next-auth" {
  interface User {
    isSupplier: boolean;
    isCompanyAdmin: boolean;
    isSystemAdmin: boolean;
    companyId: string | null;
  }

  interface Session {
    user: {
      id: string;
      isSupplier: boolean;
      isCompanyAdmin: boolean;
      isSystemAdmin: boolean;
      companyId: string | null;
    } & DefaultSession["user"];
  }
}

// NextAuth's `callbacks.jwt` signature is typed against the JWT interface
// from "@auth/core/jwt" (imported internally via a relative path), not the
// "next-auth/jwt" re-export — augmenting the latter doesn't merge into it.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    isSupplier: boolean;
    isCompanyAdmin: boolean;
    isSystemAdmin: boolean;
    companyId: string | null;
  }
}
