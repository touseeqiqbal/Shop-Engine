import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { isCmsConfigured, isDatabaseConfigured } from "@/lib/db/config";
import { verifyPasswordCms } from "@/lib/cms/sales";
import { log } from "@/lib/log";

/**
 * Auth.js (NextAuth v5) – email/password credentials for admins, staff and customers.
 * JWT sessions (no session table); the role is re-read from the database on every server check (see lib/auth.ts).
 */

const credentialsSchema = z.object({ email: z.email().max(200), password: z.string().min(1).max(200) });

class InvalidLogin extends CredentialsSignin {
  code = "invalid_credentials";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-insecure-secret-change-me" : undefined),
  trustHost: true,
  // shoppers stay signed in while they come back within SHOPPER_SESSION_DAYS (default 14; renewed at most once a day)
  session: { strategy: "jwt", maxAge: Math.min(90, Math.max(1, Number(process.env.SHOPPER_SESSION_DAYS) || 14)) * 24 * 3600, updateAge: 24 * 3600 },
  // An old / foreign session cookie (e.g. after AUTH_SECRET changed) just means "signed out" – don't log it as an error
  logger: {
    error(error) {
      if ((error as { type?: string }).type === "JWTSessionError") return;
      log.error("auth.error", error);
    },
  },
  pages: { signIn: "/account/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        if (!isDatabaseConfigured) throw new InvalidLogin();
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidLogin();
        if (isCmsConfigured) {
          // Accounts live in Payload (/cms → Users & customers) since Phase 6; old passwords keep working.
          const u = await verifyPasswordCms(parsed.data.email, parsed.data.password);
          if (!u || u.blocked) throw new InvalidLogin();
          return { id: u.id, email: u.email, name: u.name, role: u.role === "customer" ? "customer" : u.role === "staff" ? "staff" : "admin" };
        }
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) throw new InvalidLogin();
        return { id: user.id, email: user.email, name: user.name ?? undefined, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role ?? "customer";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.uid as string;
        (session.user as { role?: string }).role = token.role as string;
        // when this sign-in was made – a password reset ends every sign-in made before it (lib/auth.ts)
        (session.user as { issuedAt?: number }).issuedAt = typeof token.iat === "number" ? token.iat : undefined;
      }
      return session;
    },
  },
});
