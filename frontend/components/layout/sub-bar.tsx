import { cn } from "@/lib/utils";

interface SubBarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function SubBar({ left, right, className }: SubBarProps) {
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4",
        className
      )}
    >
      <div className="flex items-center gap-2 ml-2">{left}</div>
      <div className="flex items-center gap-2 mr-2">{right}</div>
    </div>
  );
}
