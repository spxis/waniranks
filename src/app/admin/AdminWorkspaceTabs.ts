export const ADMIN_WORKSPACE_TABS = ["operations", "campaigns", "history", "users", "readingEntries"] as const;

export type AdminWorkspaceTab = (typeof ADMIN_WORKSPACE_TABS)[number];

export const ADMIN_WORKSPACE_COOKIE_KEY = "admin-workspace-last-tab";
export const ADMIN_WORKSPACE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export const ADMIN_WORKSPACE_ROUTES: Record<AdminWorkspaceTab, string> = {
  operations: "/admin/account-operations",
  campaigns: "/admin/campaign-workspace",
  history: "/admin/submission-history",
  users: "/admin/users",
  readingEntries: "/admin/reading-entries",
};

export function parseAdminWorkspaceTab(value: string | undefined, fallback: AdminWorkspaceTab = "operations"): AdminWorkspaceTab {
  if (value && ADMIN_WORKSPACE_TABS.includes(value as AdminWorkspaceTab)) {
    return value as AdminWorkspaceTab;
  }

  return fallback;
}

export function routeForAdminWorkspaceTab(tab: AdminWorkspaceTab): string {
  return ADMIN_WORKSPACE_ROUTES[tab];
}
