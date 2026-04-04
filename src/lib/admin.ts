export function isAuthorizedAdmin(request: Request): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    throw new Error("ADMIN_API_KEY is not set.");
  }

  const received = request.headers.get("x-admin-key");
  return received === expected;
}
