import { cookies } from "next/headers";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar-server";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default async function AppLayout({
  children,
  header,
  subbar,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  subbar: React.ReactNode;
}) {
  // Sidebar state persistence
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 px-4 border-b">
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger className="ml-2.5" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Toggle sidebar (⌘B)</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          {header}
        </header>
        {subbar}
        <div className="flex flex-1 flex-col min-h-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
