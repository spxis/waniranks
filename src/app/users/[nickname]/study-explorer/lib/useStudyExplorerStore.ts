import { create } from "zustand";
import type { SetStateAction } from "react";

import type { StudySrsFilter, StudyTypeFilter } from "./studyExplorerTypes";

type StudyUiState = {
  viewedLevel: number | null;
  typeFilter: StudyTypeFilter;
  srsFilter: StudySrsFilter;
  selectedId: number | null;
  showLocked: boolean;
  recentOnly: boolean;
  searchQuery: string;
  hasHydratedTypeFilter: boolean;
};

type StudyExplorerStoreState = {
  uiByKey: Record<string, StudyUiState>;
  ensureUiKey: (key: string) => void;
  setViewedLevel: (key: string, value: SetStateAction<number | null>) => void;
  setTypeFilter: (key: string, value: SetStateAction<StudyTypeFilter>) => void;
  setSrsFilter: (key: string, value: SetStateAction<StudySrsFilter>) => void;
  setSelectedId: (key: string, value: SetStateAction<number | null>) => void;
  setShowLocked: (key: string, value: SetStateAction<boolean>) => void;
  setRecentOnly: (key: string, value: SetStateAction<boolean>) => void;
  setSearchQuery: (key: string, value: SetStateAction<string>) => void;
  setHasHydratedTypeFilter: (key: string, value: SetStateAction<boolean>) => void;
};

function defaultUiState(): StudyUiState {
  return {
    viewedLevel: null,
    typeFilter: "all",
    srsFilter: "all",
    selectedId: null,
    showLocked: true,
    recentOnly: false,
    searchQuery: "",
    hasHydratedTypeFilter: false,
  };
}

function resolveStateAction<T>(value: SetStateAction<T>, prev: T): T {
  return typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
}

function withUi(
  input: Record<string, StudyUiState>,
  key: string,
  update: (prev: StudyUiState) => StudyUiState,
): Record<string, StudyUiState> {
  const prev = input[key] ?? defaultUiState();
  return { ...input, [key]: update(prev) };
}

export const useStudyExplorerStore = create<StudyExplorerStoreState>((set) => ({
  uiByKey: {},
  ensureUiKey: (key) => {
    set((state) => {
      if (state.uiByKey[key]) {
        return state;
      }
      return { uiByKey: { ...state.uiByKey, [key]: defaultUiState() } };
    });
  },
  setViewedLevel: (key, value) => {
    set((state) => ({
      uiByKey: withUi(state.uiByKey, key, (prev) => ({
        ...prev,
        viewedLevel: resolveStateAction(value, prev.viewedLevel),
      })),
    }));
  },
  setTypeFilter: (key, value) => {
    set((state) => ({
      uiByKey: withUi(state.uiByKey, key, (prev) => ({
        ...prev,
        typeFilter: resolveStateAction(value, prev.typeFilter),
      })),
    }));
  },
  setSrsFilter: (key, value) => {
    set((state) => ({
      uiByKey: withUi(state.uiByKey, key, (prev) => ({
        ...prev,
        srsFilter: resolveStateAction(value, prev.srsFilter),
      })),
    }));
  },
  setSelectedId: (key, value) => {
    set((state) => ({
      uiByKey: withUi(state.uiByKey, key, (prev) => ({
        ...prev,
        selectedId: resolveStateAction(value, prev.selectedId),
      })),
    }));
  },
  setShowLocked: (key, value) => {
    set((state) => ({
      uiByKey: withUi(state.uiByKey, key, (prev) => ({
        ...prev,
        showLocked: resolveStateAction(value, prev.showLocked),
      })),
    }));
  },
  setRecentOnly: (key, value) => {
    set((state) => ({
      uiByKey: withUi(state.uiByKey, key, (prev) => ({
        ...prev,
        recentOnly: resolveStateAction(value, prev.recentOnly),
      })),
    }));
  },
  setSearchQuery: (key, value) => {
    set((state) => ({
      uiByKey: withUi(state.uiByKey, key, (prev) => ({
        ...prev,
        searchQuery: resolveStateAction(value, prev.searchQuery),
      })),
    }));
  },
  setHasHydratedTypeFilter: (key, value) => {
    set((state) => ({
      uiByKey: withUi(state.uiByKey, key, (prev) => ({
        ...prev,
        hasHydratedTypeFilter: resolveStateAction(value, prev.hasHydratedTypeFilter),
      })),
    }));
  },
}));
