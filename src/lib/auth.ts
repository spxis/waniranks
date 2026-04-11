import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

function parseAdminEmailAllowlist(): Set<string> {
  const raw = process.env.ADMIN_GOOGLE_ALLOWED_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

const adminEmailAllowlist = parseAdminEmailAllowlist();

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return adminEmailAllowlist.has(email.toLowerCase());
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    signIn({ account }) {
      if (account?.provider !== "google") {
        return false;
      }

      return true;
    },
  },
  secret: process.env.AUTH_SECRET,
};
