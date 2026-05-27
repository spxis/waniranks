"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type UserReadingBookCoverImageProps = {
  isbn?: string;
  title: string;
  thumbnailUrl: string | null;
  width: number;
  height: number;
  className?: string;
  alt?: string;
  size?: "small" | "large";
};

const PLACEHOLDER_COVER_URL = "/images/book-cover-placeholder.svg";

function normalizeCoverUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export default function UserReadingBookCoverImage({
  isbn,
  title,
  thumbnailUrl,
  width,
  height,
  className,
  alt,
  size = "small",
}: UserReadingBookCoverImageProps) {
  const coverProxyUrl = useMemo(
    () => (isbn ? `/api/reading-books/cover?isbn=${encodeURIComponent(isbn)}&size=${size}&v=4` : null),
    [isbn, size],
  );
  const openLibraryUrl = useMemo(
    () => (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-${size === "large" ? "L" : "M"}.jpg?default=false` : null),
    [isbn, size],
  );
  const fallbackCandidates = useMemo(() => {
    const small = normalizeCoverUrl(thumbnailUrl);
    // Proxy is the canonical source at both sizes — it honours any manual
    // cover URL override. Stored thumbnailUrl and direct OpenLibrary act as
    // fallbacks if the proxy can't resolve a usable image.
    const ordered = [coverProxyUrl, openLibraryUrl, small, PLACEHOLDER_COVER_URL];
    const candidates = ordered.filter((value): value is string => Boolean(value));
    return [...new Set(candidates)];
  }, [thumbnailUrl, coverProxyUrl, openLibraryUrl]);
  const [failedSources, setFailedSources] = useState<Record<string, true>>({});
  const currentSrc = useMemo(
    () => fallbackCandidates.find((candidate) => !failedSources[candidate]) ?? PLACEHOLDER_COVER_URL,
    [fallbackCandidates, failedSources],
  );

  function handleError() {
    setFailedSources((previous) => {
      if (previous[currentSrc]) {
        return previous;
      }

      return {
        ...previous,
        [currentSrc]: true,
      };
    });
  }

  return (
    <Image
      src={currentSrc}
      alt={alt ?? title}
      width={width}
      height={height}
      className={className}
      onError={handleError}
      unoptimized={currentSrc === PLACEHOLDER_COVER_URL || currentSrc.startsWith("/api/")}
    />
  );
}
