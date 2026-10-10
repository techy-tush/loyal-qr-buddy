import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Puzzle,
  UtensilsCrossed,
  LayoutDashboard,
  Users,
  Stamp,
  QrCode,
  Gift,
  Ticket,
  Sparkles,
  UtensilsCrossed,
  Building2,
  UserCog,
  ShieldCheck,
  ShieldAlert,

  Megaphone,
  BarChart3,
  CreditCard,
  Settings,
  LifeBuoy,
  MessageSquare,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BusinessProvider, useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Users; roles?: string[] };

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/offers", label: "Offers", icon: Sparkles, roles: ["BUSINESS_OWNER", "BUSINESS_MANAGER", "SUPER_ADMIN"] },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/qr-codes", label: "My shop QR", icon: QrCode },
  { to: "/addons", label: "Add-ons", icon: Puzzle, roles: ["BUSINESS_OWNER", "SUPER_ADMIN"] },
  { to: "/menu-builder", label: "Digital menu", icon: UtensilsCrossed, roles: ["BUSINESS_OWNER", "BUSINESS_MANAGER", "SUPER_ADMIN"] },
  { to: "/loyalty", label: "Reward rule", icon: Stamp, roles: ["BUSINESS_OWNER", "BUSINESS_MANAGER", "SUPER_ADMIN"] },
  { to: "/feedback", label: "Feedback", icon: MessageSquare },
  { to: "/branches", label: "Branches", icon: Building2, roles: ["BUSINESS_OWNER", "SUPER_ADMIN"] },
  { to: "/staff", label: "Staff", icon: UserCog, roles: ["BUSINESS_OWNER", "SUPER_ADMIN"] },
  { to: "/subscription", label: "Subscription", icon: CreditCard, roles: ["BUSINESS_OWNER", "SUPER_ADMIN"] },
  { to: "/admin", label: "Platform admin", icon: ShieldCheck, roles: ["SUPER_ADMIN"] },
  { to: "/security", label: "Security audit", icon: ShieldAlert, roles: ["SUPER_ADMIN"] },
  { to: "/settings", label: "Settings", icon: Settings },
];

const mobileNav: NavItem[] = [
  { to: "/dashboard", label: "Approvals", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/offers", label: "Offers", icon: Sparkles },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <BusinessProvider>
      <Shell>{children}</Shell>
    </BusinessProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { business, businesses, setBusinessId, branches, branchId, setBranchId, role, loading } =
    useBusiness();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  const visibleNav = navItems.filter((i) => !i.roles || (role && i.roles.includes(role)));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-24 w-64 rounded-2xl" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <Logo />
        <h1 className="text-xl font-bold">No business yet</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Set up your business, first branch and loyalty program to start collecting customers.
        </p>
        <Button asChild>
          <Link to="/onboarding">Start setup</Link>
        </Button>
        <button onClick={signOut} className="text-xs text-muted-foreground underline">
          Sign out
        </button>
      </div>
    );
  }

  const sidebar = (compact = false) => (
    <nav className="flex flex-col gap-1 p-3">
      {visibleNav.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {!compact ? <span className="truncate">{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:block",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        <div className={cn("flex h-16 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
          {collapsed ? (
            <Link to="/dashboard" aria-label="Digital Udyam" className="grid size-9 place-items-center rounded-md bg-sidebar-primary font-display text-sm font-extrabold text-sidebar-primary-foreground">
              DU
            </Link>
          ) : (
            <Logo to="/dashboard" />
          )}
        </div>
        {sidebar(collapsed)}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute bottom-4 right-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </aside>
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-30 grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur md:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex h-16 items-center border-b border-border px-4">
                <Logo to="/dashboard" />
              </div>
              {sidebar()}
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            {businesses.length > 1 ? (
              <Select value={business.id} onValueChange={setBusinessId}>
                <SelectTrigger className="h-9 w-[190px] border-0 bg-transparent font-semibold shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="truncate font-display text-sm font-bold">{business.name}</p>
            )}
          </div>

          <div className="hidden sm:block">
          {branches.length > 0 ? (
            <Select
              value={branchId ?? "all"}
              onValueChange={(v) => setBranchId(v === "all" ? null : v)}
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                <span className="text-xs font-bold">
                  {business.name.slice(0, 2).toUpperCase()}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Signed in as {role?.replace("_", " ").toLowerCase()}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 pb-28 md:p-6 lg:pb-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-[76px] grid-cols-5 border-t border-border bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {mobileNav.filter((item) => !item.roles || (role && item.roles.includes(role))).map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className={cn("grid size-8 place-items-center rounded-md", active && "bg-accent")}>
                <item.icon className="size-5" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-extrabold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-md bg-accent text-primary">
        <Icon className="size-6" />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon?: typeof Users;
  hint?: string;
}) {
  return (
    <div className="surface p-4 md:p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 text-primary" /> : null}
      </div>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
