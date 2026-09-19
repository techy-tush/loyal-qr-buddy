import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="brand-gradient flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Logo />
      <div className="surface mt-8 w-full max-w-md p-7 shadow-lift">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-6 text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
