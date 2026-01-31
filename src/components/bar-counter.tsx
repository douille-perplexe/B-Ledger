"use client";

import { cn } from "@/lib/utils";

interface BarCounterProps {
  count: number;
  max?: number;
  size?: "sm" | "md" | "lg";
}

export function BarCounter({ count, max = 5, size = "md" }: BarCounterProps) {
  const sizes = {
    sm: "h-3 w-1.5",
    md: "h-5 w-2",
    lg: "h-8 w-3",
  };

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={cn(
            sizes[size],
            "rounded-sm transition-colors",
            i < count
              ? "bg-destructive"
              : "bg-muted"
          )}
        />
      ))}
      <span className="ml-1.5 text-sm font-medium tabular-nums">
        {count}/{max}
      </span>
    </div>
  );
}
