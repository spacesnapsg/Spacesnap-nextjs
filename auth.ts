import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      // Sprint 2: implement credential verification against the Prisma User model.
      authorize: async () => {
        return null;
      },
    }),
  ],
});
