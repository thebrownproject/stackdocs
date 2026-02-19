"use client";

import Markdown, { Components } from "react-markdown";
import { LOADING_MIN_HEIGHT } from "./constants";

// Sanitize links to only allow safe protocols (prevent javascript: XSS)
const markdownComponents: Components = {
  a: ({ href, children }) => {
    const safeHref = href || "";
    if (!/^(https?:|mailto:)/i.test(safeHref)) {
      return <span className="text-muted-foreground">{children}</span>;
    }
    return (
      <a href={safeHref} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

interface TextContentProps {
  text: string | null;
  isLoading?: boolean;
}

export function TextContent({ text, isLoading }: TextContentProps) {
  // While loading, show blank space with min-height to prevent container collapse
  if (isLoading) {
    return <div className={`h-full ${LOADING_MIN_HEIGHT}`} />;
  }

  if (!text?.trim()) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No OCR text available</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto pt-8 px-8">
      <div
        className="prose prose-sm dark:prose-invert max-w-none
        prose-headings:font-medium prose-headings:text-foreground
        prose-p:text-foreground prose-p:leading-relaxed
        prose-strong:text-foreground
        prose-ul:text-foreground prose-ol:text-foreground
        prose-li:text-foreground
        prose-table:text-sm
        prose-th:bg-muted prose-th:px-3 prose-th:py-2
        prose-td:px-3 prose-td:py-2 prose-td:border-border"
      >
        <Markdown components={markdownComponents}>{text}</Markdown>
      </div>
    </div>
  );
}
