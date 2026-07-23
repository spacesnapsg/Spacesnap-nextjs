import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Auth.js v5 refuses to start with a database session strategy when
// Credentials is the only provider (see @auth/core/lib/utils/assert.js,
// UnsupportedStrategy) — Credentials sign-in never goes through the
// adapter's user/account flow, so there's no adapter session to persist.
// JWT is the only strategy this combination supports; the adapter stays
// registered for when an OAuth provider is added later.
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isSupplier: user.isSupplier,
          isMember: user.isMember,
          isCompanyAdmin: user.isCompanyAdmin,
          isSystemAdmin: user.isSystemAdmin,
          companyId: user.companyId ? user.companyId.toString() : null,
          isBuyerOrgAdmin: user.isBuyerOrgAdmin,
          buyerOrganizationId: user.buyerOrganizationId ? user.buyerOrganizationId.toString() : null,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        // authorize() always sets `id` (a real Prisma cuid); DefaultUser
        // only declares it optional for OAuth providers that may omit it.
        token.id = user.id!;
        token.isSupplier = user.isSupplier;
        token.isMember = user.isMember;
        token.isCompanyAdmin = user.isCompanyAdmin;
        token.isSystemAdmin = user.isSystemAdmin;
        token.companyId = user.companyId;
        token.isBuyerOrgAdmin = user.isBuyerOrgAdmin;
        token.buyerOrganizationId = user.buyerOrganizationId;
        // Sprint 6.12 — stamp real request-level activity for the EDM
        // popup's 6-hour trigger (lib/edm-campaigns.ts). Fire-and-forget is
        // deliberately not used here: this is the first-sign-in branch, so
        // there's no risk of racing the per-request re-check below within
        // the same token's lifetime.
        await prisma.user.update({ where: { id: user.id! }, data: { lastActivityAt: new Date() } });
        return token;
      }

      // A JWT stays valid until it expires — unlike a database session, it
      // can't be revoked by deleting a row. Re-check status on every session
      // read so a suspend takes effect immediately instead of waiting out
      // the token's lifetime. Returning null here forces sign-out: the core
      // session handler clears the session cookie instead of returning a body.
      // Folds the Sprint 6.12 lastActivityAt stamp into this same existing
      // per-request round trip (an UPDATE instead of a SELECT) rather than
      // adding a second query. update() throws P2025 instead of resolving
      // null when the row no longer exists (unlike findUnique), so the
      // not-found case moves into the catch below.
      let current;
      try {
        current = await prisma.user.update({
          where: { id: token.id },
          data: { lastActivityAt: new Date() },
          select: {
            status: true,
            isSupplier: true,
            isMember: true,
            isCompanyAdmin: true,
            isSystemAdmin: true,
            companyId: true,
            isBuyerOrgAdmin: true,
            buyerOrganizationId: true,
          },
        });
      } catch {
        return null;
      }

      if (current.status === "suspended") {
        return null;
      }

      token.isSupplier = current.isSupplier;
      token.isMember = current.isMember;
      token.isCompanyAdmin = current.isCompanyAdmin;
      token.isSystemAdmin = current.isSystemAdmin;
      token.companyId = current.companyId ? current.companyId.toString() : null;
      token.isBuyerOrgAdmin = current.isBuyerOrgAdmin;
      token.buyerOrganizationId = current.buyerOrganizationId ? current.buyerOrganizationId.toString() : null;

      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id;
      session.user.isSupplier = token.isSupplier;
      session.user.isMember = token.isMember;
      session.user.isCompanyAdmin = token.isCompanyAdmin;
      session.user.isSystemAdmin = token.isSystemAdmin;
      session.user.companyId = token.companyId;
      session.user.isBuyerOrgAdmin = token.isBuyerOrgAdmin;
      session.user.buyerOrganizationId = token.buyerOrganizationId;
      return session;
    },
  },
});
