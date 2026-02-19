"use client";

import { useState, useEffect } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { PreviewPanel } from "@/components/preview-panel";
import { usePreviewPanel } from "@/components/preview-panel/preview-panel-context";
import { useSelectedDocument } from "@/components/documents/selected-document-context";

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { panelRef, isCollapsed, setIsCollapsed } = usePreviewPanel();
  const {
    signedUrl,
    ocrText,
    mimeType,
    selectedDocId,
    signedUrlDocId,
    filename,
    fileSize,
    pageCount,
    extractedFields,
  } = useSelectedDocument();

  // Don't render panels until after hydration - prevents wrong position flash
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isUrlStale = selectedDocId !== null && selectedDocId !== signedUrlDocId;
  const effectivePdfUrl = isUrlStale ? null : signedUrl;
  const effectiveOcrText = isUrlStale ? null : ocrText;

  // During SSR, render children only (no panels, no handle)
  if (!mounted) {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0 overflow-hidden"
        autoSaveId="stackdocs-preview-panel"
      >
        <ResizablePanel
          defaultSize={60}
          minSize={40}
          className="overflow-hidden min-w-0 flex flex-col"
        >
          {children}
        </ResizablePanel>

        <ResizableHandle disabled={isCollapsed} />

        <ResizablePanel
          ref={panelRef}
          defaultSize={40}
          minSize={30}
          maxSize={60}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className="overflow-hidden min-w-0"
        >
          <div className="h-full">
            <PreviewPanel
              content={{
                pdfUrl: effectivePdfUrl,
                ocrText: effectiveOcrText,
                isLoading: isUrlStale,
              }}
              metadata={{
                mimeType,
                filename,
                fileSize,
                pageCount,
                extractedFields,
              }}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
