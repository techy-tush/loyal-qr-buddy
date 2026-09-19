import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Gift, Stamp, Star, Ticket } from "lucide-react";
import { AppShell, PageHeader, StatCard } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";
import { StampGrid } from "@/components/loyalty/StampGrid";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  head: () => ({
    meta: [
      { title: "Customer profile | Digital Udyam" },
      { name: "description", content: "Visits, stamps, rewards and feedback for a single customer." },
      { property: "og:title", content: "Customer profile | Digital Udyam" },
      { property: "og:description", content: "A full loyalty history for every customer." },
    ],
  }),
  component: () => (
    <AppShell>
      <CustomerDetail />
    </AppShell>
  ),
});

function CustomerDetail() {
  const { customerId } = Route.useParams();
  const { business } = useBusiness();
  const businessId = business!.id;

  const query = useQuery({
    queryKey: ["customer-detail", businessId, customerId],
    queryFn: async () => {
      const [customer, card, program, stamps, rewards, redemptions, feedback] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).single(),
        supabase
          .from("loyalty_cards")
          .select("*")
          .eq("customer_id", customerId)
          .maybeSingle(),
        supabase
          .from("loyalty_programs")
          .select("*")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("stamp_events")
          .select("id, source, created_at, branch_id")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("rewards")
          .select("id, code, description, status, expires_at, created_at, redeemed_at")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("offer_redemptions")
          .select("id, created_at, offers(title)")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("feedback")
          .select("id, rating, comment, created_at")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
      ]);
      if (customer.error) throw customer.error;
      return {
        customer: customer.data,
        card: card.data,
        program: program.data,
        stamps: stamps.data ?? [],
        rewards: rewards.data ?? [],
        redemptions: redemptions.data ?? [],
        feedback: feedback.data ?? [],
      };
    },
  });

  if (query.isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (query.error || !query.data)
    return <p className="text-sm text-destructive">This customer could not be loaded.</p>;

  const { customer, card, program, stamps, rewards, redemptions, feedback } = query.data;

  return (
    <>
      <Link to="/customers" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="size-3.5" /> Back to customers
      </Link>
      <PageHeader
        title={customer.full_name}
        description={`${customer.phone}${customer.email ? ` · ${customer.email}` : ""}`}
        action={customer.is_vip ? <Badge>VIP</Badge> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total visits" value={customer.total_visits ?? 0} />
        <StatCard label="Stamps on card" value={card?.stamps ?? 0} icon={Stamp} />
        <StatCard label="Rewards earned" value={rewards.length} icon={Gift} />
        <StatCard
          label="Rewards redeemed"
          value={rewards.filter((r) => r.status === "REDEEMED").length}
        />
        <StatCard
          label="Last visit"
          value={customer.last_visit_at ? new Date(customer.last_visit_at).toLocaleDateString() : "—"}
        />
      </div>

      {program ? (
        <div className="surface mt-6 p-5">
          <h3 className="text-sm font-semibold">{program.name}</h3>
          <p className="text-xs text-muted-foreground">
            {program.stamps_required} stamps → {program.reward_description}
          </p>
          <div className="mt-4">
            <StampGrid stamps={card?.stamps ?? 0} required={program.stamps_required} />
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="stamps" className="mt-6">
        <TabsList>
          <TabsTrigger value="stamps">Stamps</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="stamps">
          <ListCard
            empty="No stamps issued yet."
            items={stamps.map((s) => ({
              id: s.id,
              title: `Stamp issued (${s.source.toLowerCase().replace("_", " ")})`,
              meta: new Date(s.created_at).toLocaleString(),
            }))}
          />
        </TabsContent>
        <TabsContent value="rewards">
          <ListCard
            empty="No rewards unlocked yet."
            items={rewards.map((r) => ({
              id: r.id,
              title: `${r.description} · ${r.code}`,
              meta: `${r.status}${r.expires_at ? ` · expires ${new Date(r.expires_at).toLocaleDateString()}` : ""}`,
            }))}
          />
        </TabsContent>
        <TabsContent value="offers">
          <ListCard
            icon={Ticket}
            empty="No offers redeemed yet."
            items={redemptions.map((r) => ({
              id: r.id,
              title:
                (r as unknown as { offers?: { title?: string } }).offers?.title ?? "Offer redeemed",
              meta: new Date(r.created_at).toLocaleString(),
            }))}
          />
        </TabsContent>
        <TabsContent value="feedback">
          <ListCard
            icon={Star}
            empty="No feedback submitted yet."
            items={feedback.map((f) => ({
              id: f.id,
              title: `${f.rating}★ ${f.comment ?? ""}`,
              meta: new Date(f.created_at).toLocaleString(),
            }))}
          />
        </TabsContent>
        <TabsContent value="profile">
          <div className="surface grid gap-3 p-5 text-sm sm:grid-cols-2">
            <Info label="Full name" value={customer.full_name} />
            <Info label="Phone" value={customer.phone} />
            <Info label="Email" value={customer.email ?? "—"} />
            <Info label="Date of birth" value={customer.dob ?? "—"} />
            <Info label="Anniversary" value={customer.anniversary ?? "—"} />
            <Info label="Marketing consent" value={customer.marketing_consent ? "Yes" : "No"} />
            <Info label="Joined" value={new Date(customer.created_at).toLocaleDateString()} />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function ListCard({
  items,
  empty,
}: {
  items: { id: string; title: string; meta: string }[];
  empty: string;
  icon?: unknown;
}) {
  if (items.length === 0)
    return <p className="surface p-5 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="surface divide-y divide-border">
      {items.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
          <span className="font-medium">{i.title}</span>
          <span className="text-xs text-muted-foreground">{i.meta}</span>
        </li>
      ))}
    </ul>
  );
}
