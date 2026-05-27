import { AppSidebarClient } from "./app-sidebar-client";

export async function AppSidebar(props: React.ComponentProps<typeof AppSidebarClient>) {
  return <AppSidebarClient {...props} />;
}
