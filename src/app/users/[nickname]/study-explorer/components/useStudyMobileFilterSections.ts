import { useEffect, useState } from "react";

export type StudyMobileFilterSectionKey = "level" | "grouping" | "status";

type StudyMobileFilterSectionState = Record<StudyMobileFilterSectionKey, boolean>;

const DEFAULT_MOBILE_FILTER_SECTIONS_OPEN: StudyMobileFilterSectionState = {
  level: true,
  grouping: true,
  status: true,
};

const STUDY_MOBILE_FILTER_SECTIONS_STORAGE_KEY = "wr:study:mobile-filter-sections-open";

function readInitialSectionsState(): StudyMobileFilterSectionState {
  if (typeof window === "undefined") {
    return DEFAULT_MOBILE_FILTER_SECTIONS_OPEN;
  }

  try {
    const raw = window.localStorage.getItem(STUDY_MOBILE_FILTER_SECTIONS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_MOBILE_FILTER_SECTIONS_OPEN;
    }

    const parsed = JSON.parse(raw) as Partial<Record<StudyMobileFilterSectionKey, unknown>>;
    return {
      level: typeof parsed.level === "boolean" ? parsed.level : DEFAULT_MOBILE_FILTER_SECTIONS_OPEN.level,
      grouping: typeof parsed.grouping === "boolean" ? parsed.grouping : DEFAULT_MOBILE_FILTER_SECTIONS_OPEN.grouping,
      status: typeof parsed.status === "boolean" ? parsed.status : DEFAULT_MOBILE_FILTER_SECTIONS_OPEN.status,
    };
  } catch {
    return DEFAULT_MOBILE_FILTER_SECTIONS_OPEN;
  }
}

export function useStudyMobileFilterSections() {
  const [sectionsOpen, setSectionsOpen] = useState<StudyMobileFilterSectionState>(readInitialSectionsState);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        STUDY_MOBILE_FILTER_SECTIONS_STORAGE_KEY,
        JSON.stringify(sectionsOpen),
      );
    } catch {
      // Ignore storage access errors in restricted modes.
    }
  }, [sectionsOpen]);

  const toggleSection = (section: StudyMobileFilterSectionKey) => {
    setSectionsOpen((previous) => ({
      ...previous,
      [section]: !previous[section],
    }));
  };

  const setSectionOpen = (section: StudyMobileFilterSectionKey, isOpen: boolean) => {
    setSectionsOpen((previous) => {
      if (previous[section] === isOpen) {
        return previous;
      }
      return {
        ...previous,
        [section]: isOpen,
      };
    });
  };

  return { sectionsOpen, toggleSection, setSectionOpen };
}
