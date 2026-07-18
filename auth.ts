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
          isCompanyAdmin: user.isCompanyAdmin,
          isSystemAdmin: user.isSystemAdmin,
          companyId: user.companyId ? user.companyId.toString() : null,
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
        token.isCompanyAdmin = user.isCompanyAdmin;
        token.isSystemAdmin = user.isSystemAdmin;
        token.companyId = user.companyId;
        return token;
      }

      // A JWT stays valid until it expires — unlike a database session, it
      // can't be revoked by deleting a row. Re-check status on every session
      // read so a suspend takes effect immediately instead of waiting out
      // the token's lifetime. Returning null here forces sign-out: the core
      // session handler clears the session cookie instead of returning a body.
      const current = await prisma.user.findUnique({
        where: { id: token.id },
        select: { status: true, isSupplier: true, isCompanyAdmin: true, isSystemAdmin: true, companyId: true },
      });

      if (!current || current.status === "suspended") {
        return null;
      }

      token.isSupplier = current.isSupplier;
      token.isCompanyAdmin = current.isCompanyAdmin;
      token.isSystemAdmin = current.isSystemAdmin;
      token.companyId = current.companyId ? current.companyId.toString() : null;

      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id;
      session.user.isSupplier = token.isSupplier;
      session.user.isCompanyAdmin = token.isCompanyAdmin;
      session.user.isSystemAdmin = token.isSystemAdmin;
      session.user.companyId = token.companyId;
      return session;
    },
  },
});
