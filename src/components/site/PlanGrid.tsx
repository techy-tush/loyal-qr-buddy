import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, code, name, price_monthly, price_yearly, max_branches, features, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function PlanGrid() {
  const { data, isLoading } = usePlans();

  if (isLoading) {
    return (
      <div className="grid gap-5 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-4">
      {(data ?? []).map((plan, i) => (
        <div
          key={plan.id}
          className={
            i === 1
              ? "relative rounded-2xl border-2 border-primary bg-background p-6 shadow-lift"
              : "rounded-2xl border border-border bg-background p-6"
          }
        >
          {i === 1 ? (
            <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              Most popular
            </span>
          ) : null}
          <h3 className="font-display text-lg font-bold">{plan.name}</h3>
          <p className="mt-3">
            <span className="text-3xl font-extrabold">
              {Number(plan.price_monthly) === 0 ? "Custom" : `₹${Number(plan.price_monthly)}`}
            </span>
            {Number(plan.price_monthly) === 0 ? null : (
              <span className="text-sm text-muted-foreground">/month</span>
            )}
          </p>
          <ul className="mt-5 space-y-2.5">
            {((plan.features as string[]) ?? []).map((f) => (
              <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
          <Button className="mt-6 w-full" variant={i === 1 ? "default" : "outline"} asChild>
            <Link to="/signup">
              {Number(plan.price_monthly) === 0 ? "Contact sales" : "Start free trial"}
            </Link>
          </Button>
        </div>
      ))}
    </div>
  );
}
