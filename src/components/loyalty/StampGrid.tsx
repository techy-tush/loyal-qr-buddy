import { Check, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

export function StampGrid({
  stamps,
  required,
  animateLast = false,
}: {
  stamps: number;
  required: number;
  animateLast?: boolean;
}) {
  const remaining = Math.max(required - stamps, 0);
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>
          {stamps} / {required} stamps
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {remaining === 0 ? "Reward unlocked!" : `${remaining} more to unlock your reward`}
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-accent">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${Math.min(100, (stamps / Math.max(required, 1)) * 100)}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: required }).map((_, i) => {
          const filled = i < stamps;
          return (
            <div
              key={i}
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl border text-xs",
                filled
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-dashed border-border bg-card text-muted-foreground",
                filled && animateLast && i === stamps - 1 && "stamp-pop",
              )}
            >
              {filled ? <Check className="size-4" /> : <Coffee className="size-4 opacity-40" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
