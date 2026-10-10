import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QrCode } from "lucide-react";
import { AppShell, EmptyState, PageHeader, StatCard } from "@/components/app/AppShell";
import { QrCard } from "@/components/qr/QrCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/qr-codes")({
  head: () => ({
    meta: [
      { title: "My shop QR | Digital Udyam" },
      { name: "description", content: "Your one permanent shop QR code — print it, share it, track scans." },
      { property: "og:title", content: "My shop QR | Digital Udyam" },
      { property: "og:description", content: "One permanent QR code for your shop's loyalty, offers, menu and reviews." },
    ],
  }),
  component: () => (
    <AppShell>
      <QrCodesPage />
    </AppShell>
  ),
});

function QrCodesPage() {
  const { business } = useBusiness();
  const businessId = business!.id;
  const queryClient = useQueryClient();

  const codes = useQuery({
    queryKey: ["qr-codes", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("id, label, token, scan_count, created_at")
        .eq("business_id", businessId)
        .order("created_at")
        .limit(1);
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("qr_codes").insert({
        business_id: businessId,
        label: business!.name,
        qr_type: "BUSINESS",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Your shop QR is ready");
      queryClient.invalidateQueries({ queryKey: ["qr-codes", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const code = codes.data?.[0];

  return (
    <div>
      <PageHeader title="My shop QR" description="One permanent QR for your shop. Print it at the counter, tables or entrance." />
      {codes.isLoading ? (
        <Skeleton className="h-96 max-w-md rounded-2xl" />
      ) : !code ? (
        <EmptyState
          icon={QrCode}
          title="No shop QR yet"
          description="Create your permanent shop QR and share it to get your first customer."
          action={<Button onClick={() => create.mutate()} disabled={create.isPending}>Create my shop QR</Button>}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,420px)_1fr]">
          <div className="surface p-5">
            <QrCard token={code.token} title={business!.name} />
          </div>
          <div className="space-y-4">
            <StatCard label="Total scans" value={code.scan_count ?? 0} icon={QrCode} />
            <div className="surface p-5 text-sm text-muted-foreground">
              This QR never changes. Customers who scan it can join, request a visit, see your offers,
              and — if those add-ons are active — open your digital menu or write a Google review.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
