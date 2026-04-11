import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { authOptions, isAdminEmail, isGoogleAuthConfigured } from "@/lib/auth";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
} from "@/lib/adminSession";

export async function GET(request: Request) {
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
}

export async function POST(request: Request) {
  try {
    if (!(await isAuthorizedAdmin(request))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set({
      name: ADMIN_SESSION_COOKIE_NAME,
      value: createAdminSessionToken(),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.json({ authorized: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not create admin session." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);

    return NextResponse.json({ authorized: false });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not clear admin session." }, { status: 500 });
  }
}
