"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { toOpenLibraryCoverUrl } from "@/lib/readingSignoff";

type UserReadingBookCoverImageProps = {
  isbn?: string;
  title: string;
  thumbnailUrl: string | null;
  width: number;
  height: number;
  className?: string;
  alt?: string;
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
}: UserReadingBookCoverImageProps) {
  const coverProxyUrl = useMemo(
    () => (isbn ? `/api/reading-books/cover?isbn=${encodeURIComponent(isbn)}&v=3` : null),
    [isbn],
  );
  const openLibraryUrl = useMemo(() => (isbn ? toOpenLibraryCoverUrl(isbn) : null), [isbn]);
  const fallbackCandidates = useMemo(() => {
    const primary = normalizeCoverUrl(thumbnailUrl);
    const candidates = [primary, coverProxyUrl, openLibraryUrl, PLACEHOLDER_COVER_URL].filter((value): value is string => Boolean(value));
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
      unoptimized={currentSrc === PLACEHOLDER_COVER_URL}
    />
  );
}
