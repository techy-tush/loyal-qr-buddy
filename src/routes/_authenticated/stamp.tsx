import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Gift, Search, Stamp as StampIcon } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { StampGrid } from "@/components/loyalty/StampGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusiness } from "@/hooks/use-business";
import { findCustomerByPhone, issueStamp, redeemReward } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/stamp")({
  head: () => ({
    meta: [
      { title: "Stamp & redeem | Digital Udyam" },
      {
        name: "description",
        content: "Staff console to add stamps and redeem reward codes with backend validation.",
      },
      { property: "og:title", content: "Stamp & redeem | Digital Udyam" },
      {
        property: "og:description",
        content: "Find a customer by phone, add their visit stamp and redeem reward codes safely.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <StampConsole />
    </AppShell>
  ),
});

function StampConsole() {
  const { business, branchId } = useBusiness();
  const businessId = business!.id;
  const findFn = useServerFn(findCustomerByPhone);
  const stampFn = useServerFn(issueStamp);
  const redeemFn = useServerFn(redeemReward);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [justStamped, setJustStamped] = useState(false);

  const find = useMutation({
    mutationFn: (value: string) => findFn({ data: { businessId, phone: value } }),
    onSuccess: () => setJustStamped(false),
    onError: (e: Error) => toast.error(e.message),
  });

  const stamp = useMutation({
    mutationFn: (customerId: string) =>
      stampFn({ data: { customerId, branchId: branchId ?? null } }),
    onSuccess: (res) => {
      setJustStamped(true);
      toast.success(
        res.rewardUnlocked
          ? `Reward unlocked — code ${res.rewardCode}`
          : `Stamp added (${res.stamps}/${res.stampsRequired})`,
      );
      find.mutate(phone);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const redeem = useMutation({
    mutationFn: (value: string) => redeemFn({ data: { businessId, code: value } }),
    onSuccess: (res) => {
      toast.success(`Redeemed “${res.description}” for ${res.customerName}`);
      setCode("");
      if (find.data) find.mutate(phone);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const result = find.data;
  const program = result?.card?.program as
    | { name: string; stamps_required: number; reward_description: string }
    | null
    | undefined;

  return (
    <div>
      <PageHeader
        title="Stamp & redeem"
        description="Everything here is validated on the server — cooldowns, daily limits and one-time reward codes."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <StampIcon className="size-4 text-primary" /> Add a stamp
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              find.mutate(phone);
            }}
          >
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="phone" className="sr-only">
                Customer mobile number
              </Label>
              <Input
                id="phone"
                inputMode="tel"
                maxLength={20}
                placeholder="Customer mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={find.isPending || phone.trim().length < 4}>
              <Search className="mr-1.5 size-4" /> Find
            </Button>
          </form>

          {result ? (
            <div className="mt-5 rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{result.customer.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.customer.phone} · {result.customer.total_visits} visits ·{" "}
                    {result.customer.last_visit_at
                      ? `last visit ${new Date(result.customer.last_visit_at).toLocaleDateString()}`
                      : "no visits yet"}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => stamp.mutate(result.customer.id)}
                  disabled={stamp.isPending}
                >
                  {stamp.isPending ? "Adding…" : "Add stamp"}
                </Button>
              </div>

              {result.card && program ? (
                <div className="mt-4">
                  <StampGrid
                    stamps={result.card.stamps}
                    required={program.stamps_required}
                    animateLast={justStamped}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {program.name} · reward {program.reward_description}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  No stamp card yet — adding a stamp will start one.
                </p>
              )}

              {result.rewards.length > 0 ? (
                <div className="mt-4 space-y-1.5 border-t border-border pt-3">
                  <p className="text-xs font-semibold text-muted-foreground">Rewards waiting</p>
                  {result.rewards.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setCode(r.code)}
                      className="flex w-full items-center justify-between rounded-lg bg-accent/40 px-3 py-2 text-left text-xs"
                    >
                      <span>{r.description}</span>
                      <span className="font-mono font-bold text-primary">{r.code}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              Search a customer by the mobile number they joined with.
            </p>
          )}
        </div>

        <div className="surface p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Gift className="size-4 text-primary" /> Redeem a reward code
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              redeem.mutate(code);
            }}
          >
            <Input
              placeholder="e.g. 4F9A2B7C"
              maxLength={32}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono tracking-widest"
            />
            <Button type="submit" disabled={redeem.isPending || code.trim().length < 4}>
              <BadgeCheck className="mr-1.5 size-4" /> Redeem
            </Button>
          </form>
          <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
            <li>• Codes work only for this business and only once.</li>
            <li>• Expired or cancelled codes are rejected automatically.</li>
            <li>• Every stamp and redemption is written to your audit log.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
