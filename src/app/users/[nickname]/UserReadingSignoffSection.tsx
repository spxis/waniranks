import { headers } from "next/headers";
import { getTodayDateInputValue } from "@/lib/readingSignoff";
import UserReadingSignoffPanel from "./UserReadingSignoffPanel";
import type { ReadingSignoffResponse } from "./UserReadingSignoffPanel.types";

type UserReadingSignoffSectionProps = {
  accountId: string;
};

async function loadInitialReadingSignoffData(monthKey: string): Promise<ReadingSignoffResponse | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return null;
  }

  const cookieHeader = requestHeaders.get("cookie");
  const response = await fetch(
    `${protocol}://${host}/api/reading-signoffs?month=${encodeURIComponent(monthKey)}`,
    {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as ReadingSignoffResponse;
  return payload;
}

export default async function UserReadingSignoffSection({ accountId }: UserReadingSignoffSectionProps) {
  const initialMonthKey = getTodayDateInputValue().slice(0, 7);
  const initialData = await loadInitialReadingSignoffData(initialMonthKey);

  return (
    <UserReadingSignoffPanel
      accountId={accountId}
      initialMonthKey={initialMonthKey}
      initialData={initialData}
    />
  );
}