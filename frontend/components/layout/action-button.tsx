"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  children: React.ReactNode;
  tooltip?: string;
}

export function ActionButton({
  icon,
  children,
  className,
  tooltip,
  ...props
}: ActionButtonProps) {
  const button = (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-7 px-2 text-xs text-foreground", className)}
      {...props}
    >
      {icon && (
        <span className="mr-0.5 inline-flex items-center size-3.5 [&>svg]:size-full">
          {icon}
        </span>
      )}
      {children}
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" collisionPadding={16}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
