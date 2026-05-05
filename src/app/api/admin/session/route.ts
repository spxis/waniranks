import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { authOptions, isAdminEmail, isGoogleAuthConfigured } from "@/lib/auth";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";

export async function GET(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/admin/session",
    method: "GET",
    request,
    execute: async () => {
      try {
        const session = await getServerSession(authOptions);
        const userEmail = session?.user?.email ?? null;

        return NextResponse.json({
          authorized: await isAuthorizedAdmin(request),
          googleConfigured: isGoogleAuthConfigured(),
          signedIn: Boolean(userEmail),
          emailAllowed: isAdminEmail(userEmail),
          user: {
            name: session?.user?.name ?? null,
            email: userEmail,
          },
        });
      } catch (error) {
        console.error(error);
        return NextResponse.json(
          { authorized: false, googleConfigured: false, signedIn: false, emailAllowed: false, user: null },
          { status: 500 },
        );
      }
    },
  });
}

export async function POST(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/admin/session",
    method: "POST",
    request,
    execute: async () => {
      void request;
      try {
        const session = await getServerSession(authOptions);
        if (!isAdminEmail(session?.user?.email)) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        return NextResponse.json({ authorized: true, persistentSession: false });
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not verify admin session." }, { status: 500 });
      }
    },
  });
}

export async function DELETE() {
  return withApiRouteTelemetry({
    route: "/api/admin/session",
    method: "DELETE",
    request: undefined,
    execute: async () => {
      return NextResponse.json({ authorized: false, note: "Use Google signout to end admin session." });
    },
  });
}
