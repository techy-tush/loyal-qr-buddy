import { Link } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
        <QrCode className="size-5" />
      </span>
      <span className="font-display text-lg font-extrabold tracking-tight">Digital Udyam</span>
    </Link>
  );
}
