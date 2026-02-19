"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import * as Icons from "@/components/icons";
import { LOADING_MIN_HEIGHT } from "./constants";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PdfContentProps {
  url: string | null;
  currentPage: number;
  onLoadSuccess: (info: { numPages: number }) => void;
  onLoadError?: (error: Error) => void;
  onContentReady?: (url: string) => void;
}

// Base width for initial render - will scale to fill container
const BASE_WIDTH = 600;

export function PdfContent({
  url,
  currentPage,
  onLoadSuccess,
  onLoadError,
  onContentReady,
}: PdfContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pageHeight, setPageHeight] = useState(0);
  // Simple boolean suffices because parent uses key={pdfUrl}, causing full remount on URL change
  const [hasRendered, setHasRendered] = useState(false);

  // Scale PDF to fit container using CSS transform (prevents re-renders during resize)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;

      const containerWidth = entry.contentRect.width;
      const newScale = containerWidth / BASE_WIDTH;
      setScale(newScale);
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  function handleLoadError(error: Error) {
    setError(error.message);
    onLoadError?.(error);
  }

  // Calculate scaled dimensions
  const scaledWidth = BASE_WIDTH * scale;
  const scaledHeight = pageHeight * scale;

  // Show loading until page has rendered
  const showLoading = !url || !hasRendered;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-destructive p-4 text-center">
        <div>
          <p className="font-medium">Failed to load PDF</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-auto relative w-full ${showLoading ? LOADING_MIN_HEIGHT : ""}`}
    >
      {/* Loading spinner - shows while URL is fetching OR PDF is loading */}
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-sidebar z-10">
          <Icons.Loader2 className="size-6 animate-spin text-muted-foreground/50" />
        </div>
      )}
      {/* PDF container with scaling - positioned absolutely during loading to prevent layout shift */}
      {url && (
        <div
          style={{
            width: `${scaledWidth}px`,
            height: scaledHeight > 0 ? `${scaledHeight}px` : "auto",
            position: showLoading ? "absolute" : "relative",
            opacity: showLoading ? 0 : 1,
            top: 0,
            left: 0,
          }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: `${BASE_WIDTH}px`,
            }}
          >
            <Document
              file={url}
              onLoadSuccess={onLoadSuccess}
              onLoadError={handleLoadError}
              loading={null}
            >
              <Page
                pageNumber={currentPage}
                width={BASE_WIDTH}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                onRenderSuccess={(page) => {
                  setPageHeight(page.height);
                  setHasRendered(true);
                  onContentReady?.(url);
                }}
              />
            </Document>
          </div>
        </div>
      )}
    </div>
  );
}
