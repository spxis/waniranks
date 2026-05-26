import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_WORKSPACE_COOKIE_KEY,
  parseAdminWorkspaceTab,
  routeForAdminWorkspaceTab,
} from "./AdminWorkspaceTabs";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const rememberedTab = parseAdminWorkspaceTab(cookieStore.get(ADMIN_WORKSPACE_COOKIE_KEY)?.value, "operations");

  redirect(routeForAdminWorkspaceTab(rememberedTab));
}
