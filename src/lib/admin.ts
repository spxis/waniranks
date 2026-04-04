import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/adminSession";

function getCookieValue(cookieHeader: string, cookieName: string): string | null {
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...valueParts] = cookie.trim().split("=");
    if (rawName === cookieName) {
      return valueParts.join("=");
    }
  }
  return null;
}

export function isAuthorizedAdmin(request: Request): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    throw new Error("ADMIN_API_KEY is not set.");
  }

  const received = request.headers.get("x-admin-key");
  if (received === expected) {
    return true;
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return false;
  }

  const adminSessionToken = getCookieValue(cookieHeader, ADMIN_SESSION_COOKIE_NAME);
  if (!adminSessionToken) {
    return false;
  }

  return verifyAdminSessionToken(adminSessionToken);
}
