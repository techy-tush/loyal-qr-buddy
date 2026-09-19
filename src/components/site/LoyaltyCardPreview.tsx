import { Coffee, Check } from "lucide-react";

export function LoyaltyCardPreview({ stamps = 6, total = 10 }: { stamps?: number; total?: number }) {
  return (
    <div className="surface w-full max-w-xs p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Coffee className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight">Green Bean Café</p>
          <p className="text-xs text-muted-foreground">Loyalty card</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={
              i < stamps
                ? "flex aspect-square items-center justify-center rounded-full bg-primary text-primary-foreground"
                : "flex aspect-square items-center justify-center rounded-full border-2 border-dashed border-border"
            }
          >
            {i < stamps ? <Check className="size-3.5" /> : null}
          </span>
        ))}
      </div>
      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(stamps / total) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {stamps} / {total} stamps · {total - stamps} more visits to unlock FREE Coffee
        </p>
      </div>
    </div>
  );
}
