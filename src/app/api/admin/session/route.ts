import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
} from "@/lib/adminSession";

export async function GET(request: Request) {
  try {
    return NextResponse.json({ authorized: isAuthorizedAdmin(request) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ authorized: false }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isAuthorizedAdmin(request)) {
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
