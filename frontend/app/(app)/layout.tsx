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
import { PreviewPanelProvider } from "@/components/preview-panel/preview-panel-context";
import { SelectedDocumentProvider } from "@/components/documents/selected-document-context";
import { DocumentsFilterProvider } from "@/components/documents/documents-filter-context";
import { DocumentDetailFilterProvider } from "@/components/documents/document-detail-filter-context";
import { StacksFilterProvider } from "@/components/stacks/stacks-filter-context";
import { StackDetailFilterProvider } from "@/components/stacks/stack-detail-filter-context";
import { AgentContainer } from "@/components/agent";

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
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="h-svh overflow-hidden"
    >
      <AppSidebar />
      <SidebarInset>
        <PreviewPanelProvider>
          <SelectedDocumentProvider>
            <DocumentsFilterProvider>
              <DocumentDetailFilterProvider>
                <StacksFilterProvider>
                  <StackDetailFilterProvider>
                    <header className="flex h-12 shrink-0 items-center gap-2 px-4 border-b">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarTrigger className="ml-2.5" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Toggle sidebar (⌘B)
                        </TooltipContent>
                      </Tooltip>
                      <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                      />
                      {header}
                    </header>
                    {/* SubBar slot - rendered between header and content */}
                    {subbar}
                    <div className="flex flex-1 flex-col min-h-0">{children}</div>
                    <AgentContainer />
                  </StackDetailFilterProvider>
                </StacksFilterProvider>
              </DocumentDetailFilterProvider>
            </DocumentsFilterProvider>
          </SelectedDocumentProvider>
        </PreviewPanelProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
