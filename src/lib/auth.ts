import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

let _authOptions: NextAuthOptions | null = null;

export function getAuthOptions(): NextAuthOptions {
  if (!_authOptions) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
    _authOptions = buildAuthOptions(secret);
  }
  return _authOptions;
}

// Backward-compatible export — lazy getter so the secret is validated at first
// request, not at module load (which breaks `next build` without env vars).
export const authOptions: NextAuthOptions = new Proxy({} as NextAuthOptions, {
  get(_target, prop) {
    return (getAuthOptions() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

function buildAuthOptions(secret: string): NextAuthOptions {
  return {
    adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
    secret,
  session: { strategy: "jwt", maxAge: 60 * 60 }, // 1 hour — forces role refresh
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Rate limiting is handled in middleware by IP (not here by email,
        // which would enable targeted account lockout DoS)

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user?.hashedPassword) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );

        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as string) ?? "user";
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as unknown as Record<string, unknown>).role as string;
      } else if (token.sub) {
        // Re-read role from DB on every token refresh to catch role changes
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true },
        });
        token.role = dbUser?.role ?? "user";
      }
      return token;
    },
  },
  };
}
