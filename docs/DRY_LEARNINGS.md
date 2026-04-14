# DRY Learnings Log

Date: 2026-04-13

## What We Learned

1. Shared formatting logic should live in one place.
- Date/time and relative-time formatting had drifted across dashboard, leaderboard, level explorer, and admin UI.
- Small wording/rounding differences (for example `min` vs `minute`, and future-time handling) increase inconsistency risk.

2. Async blank states are a UX bug, not just a styling issue.
- Empty-state messages can appear while async requests are still in flight.
- Users read this as "there is no data" instead of "data is loading."

3. Safe DRY wins are incremental.
- Start with pure utility extraction (no behavioral branching changes).
- Then migrate call sites one by one and validate quickly.

## What We Applied

1. Added a shared time-format utility.
- File: `src/lib/timeFormat.ts`
- Includes:
  - `toTimestampMs`
  - `formatDateTimeShort`
  - `formatDateShort`
  - `formatRelativeFromNow`

2. Migrated selected high-duplication call sites.
- `src/app/leaderboard/lib/leaderboardUtils.ts`
- `src/app/users/[nickname]/UserDashboardTabs.tsx`
- `src/app/users/[nickname]/level-explorer/lib/levelExplorerDisplayDates.ts`
- `src/app/admin/AdminAccountsSection.tsx`

3. Fixed async blank-state confusion in Study Explorer.
- `src/app/users/[nickname]/study-explorer/components/StudyExplorer.tsx`
- `src/app/users/[nickname]/study-explorer/components/StudyExplorerPanel.tsx`
- Added explicit loading indicator when queue fetch is ongoing and no items are yet renderable.

4. Added shared client storage helpers.
- File: `src/lib/clientStorage.ts`
- Includes:
  - `getLocalStorageItem`
  - `setLocalStorageItem`
  - `getStoredFlagOneIsTrue`
  - `getStoredFlagZeroIsFalse`
  - `setStoredBooleanFlag`
  - `getStoredEnum`
  - `setStoredEnum`
  - `getStoredPositiveInt`
  - `getStoredJson`
  - `setStoredJson`

5. Added reusable persisted boolean hook.
- File: `src/lib/usePersistedBoolean.ts`
- Used for collapse/expand toggles where repeated localStorage boilerplate existed.

6. Migrated low-risk localStorage callsites.
- `src/app/users/[nickname]/UserProgressPanels.tsx`
- `src/app/users/[nickname]/level-explorer/components/LevelExplorerReviewStatsCard.tsx`
- `src/app/users/[nickname]/study-explorer/components/StudyReviewModal.tsx`
- `src/app/users/[nickname]/UserDashboardTabs.tsx`

## Next Safe DRY Targets

1. Shared URL tab/query sync hook:
- Tab state + query param + popstate behavior.

2. Optional follow-up migrations to use storage helpers:
- Remaining localStorage reads/writes in leaderboard and explorer components.
