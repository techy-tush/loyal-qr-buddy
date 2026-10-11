import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/digital-udyam-logo.png.asset.json";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("flex items-center", className)}>
      <img src={logoAsset.url} alt="Digital Udyam" className="h-9 w-auto rounded-lg bg-white px-1.5 py-0.5" />
    </Link>
  );
}
