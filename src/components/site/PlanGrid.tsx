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
        .select("id, code, name, price_yearly, original_price_yearly, max_branches, features, sort_order")
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
      <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
      {(data ?? []).map((plan, i) => {
        const original = Number(plan.original_price_yearly ?? 0);
        const price = Number(plan.price_yearly);
        return (
          <div
            key={plan.id}
            className={
              i === 1
                ? "relative rounded-2xl border-2 border-primary bg-background p-6 shadow-lift"
                : "relative rounded-2xl border border-border bg-background p-6"
            }
          >
            <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              {i === 1 ? "Best value" : "Limited-time price"}
            </span>
            <h3 className="font-display text-lg font-bold">{plan.name}</h3>
            <p className="mt-3">
              {original > price ? (
                <span className="mr-2 text-lg font-semibold text-muted-foreground line-through">₹{original}</span>
              ) : null}
              <span className="text-3xl font-extrabold">₹{price}</span>
              <span className="text-sm text-muted-foreground">/year</span>
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
              <Link to="/signup">Start free trial</Link>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
