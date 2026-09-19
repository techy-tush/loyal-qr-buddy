import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Gift, Sparkles, Store } from "lucide-react";
import { getQrLanding, joinLoyalty } from "@/lib/public.functions";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/qr/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join the loyalty program | Digital Udyam" },
      {
        name: "description",
        content: "Scan, join in seconds and start collecting stamps towards your free reward.",
      },
      { property: "og:title", content: "Join the loyalty program | Digital Udyam" },
      {
        property: "og:description",
        content: "Collect digital stamps on every visit and unlock rewards automatically.",
      },
    ],
  }),
  component: QrLandingPage,
});

function QrLandingPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const landingFn = useServerFn(getQrLanding);
  const joinFn = useServerFn(joinLoyalty);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    dob: "",
    anniversary: "",
    marketing_consent: true,
  });

  const landing = useQuery({
    queryKey: ["qr-landing", token],
    queryFn: () => landingFn({ data: { token } }),
    retry: false,
  });

  const join = useMutation({
    mutationFn: () => joinFn({ data: { ...form, token } }),
    onSuccess: (res) => {
      toast.success("You're in! Here's your loyalty card.");
      navigate({ to: "/card/$customerToken", params: { customerToken: res.customerToken } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (landing.isLoading) {
    return (
      <Centered>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </Centered>
    );
  }

  if (landing.isError || !landing.data?.business) {
    return (
      <Centered>
        <div className="surface p-8 text-center">
          <h1 className="font-display text-xl font-bold">This QR code isn’t active</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask the counter for a fresh code, or try scanning again in a moment.
          </p>
        </div>
      </Centered>
    );
  }

  const { business, program, offers, branch } = landing.data;

  return (
    <Centered>
      <div className="surface overflow-hidden">
        <div className="brand-gradient px-6 py-8 text-center">
          {business.logo_url ? (
            <img
              src={business.logo_url}
              alt={business.name}
              className="mx-auto size-16 rounded-2xl bg-white object-cover"
            />
          ) : (
            <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-white text-primary">
              <Store className="size-7" />
            </span>
          )}
          <h1 className="mt-4 font-display text-2xl font-extrabold">{business.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {branch?.name ?? business.city ?? business.category ?? "Loyalty program"}
          </p>
        </div>

        <div className="space-y-5 p-6">
          {program ? (
            <div className="rounded-xl border border-border bg-accent/50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Gift className="size-4 text-primary" /> {program.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Collect {program.stamps_required} stamps and get {program.reward_description}.
              </p>
            </div>
          ) : null}

          {offers.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Live offers
              </p>
              {offers.map((o) => (
                <div key={o.id} className="rounded-xl border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="size-4 text-primary" /> {o.title}
                  </p>
                  {o.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{o.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {!showForm ? (
            <Button className="w-full" size="lg" onClick={() => setShowForm(true)}>
              Join loyalty program
            </Button>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                join.mutate();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone">Mobile number</Label>
                <Input
                  id="phone"
                  required
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="dob">Birthday (optional)</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={form.dob}
                    onChange={(e) => setForm({ ...form, dob: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="anniversary">Anniversary (optional)</Label>
                  <Input
                    id="anniversary"
                    type="date"
                    value={form.anniversary}
                    onChange={(e) => setForm({ ...form, anniversary: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={form.marketing_consent}
                  onCheckedChange={(v) => setForm({ ...form, marketing_consent: Boolean(v) })}
                />
                Send me offers, birthday treats and reward reminders.
              </label>
              <Button type="submit" size="lg" disabled={join.isPending}>
                {join.isPending ? "Creating your card…" : "Get my loyalty card"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );
}
