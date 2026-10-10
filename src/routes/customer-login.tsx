import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { setCustomerSession } from "@/lib/customer-session";
import { exploreBusinesses } from "@/lib/public.functions";
import { joinShopAsCustomer, resolveCustomerAccount, sendCustomerLoginLink } from "@/lib/customer-auth.functions";

export const Route = createFileRoute("/customer-login")({
  head: () => ({
    meta: [
      { title: "Customer login | Digital Udyam" },
      { name: "description", content: "Customers and visitors: log in with your mobile number or email to see your loyalty cards and rewards." },
      { property: "og:title", content: "Customer login | Digital Udyam" },
      { property: "og:description", content: "See your shops, visits, rewards and offers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerLogin,
});

type Shop = { id: string; name: string; city: string | null; category: string | null };

function CustomerLogin() {
  const navigate = useNavigate();
  const send = useServerFn(sendCustomerLoginLink);
  const resolve = useServerFn(resolveCustomerAccount);
  const join = useServerFn(joinShopAsCustomer);
  const explore = useServerFn(exploreBusinesses);
  const [identifier, setIdentifier] = useState("");
  const [state, setState] = useState<"checking" | "idle" | "busy" | "sent" | "not_registered" | "no_email" | "pick_shop">("checking");
  const [masked, setMasked] = useState("");
  const [shops, setShops] = useState<Shop[]>([]);

  // Coming back from the emailed link: the session is verified, open their account.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const hasLink = typeof window !== "undefined" && /access_token|code=/.test(window.location.href);
      if (!data.session || !hasLink) { if (active) setState("idle"); return; }
      try {
        const r = await resolve();
        if (!active) return;
        if (r.customerToken) {
          setCustomerSession(r.customerToken);
          navigate({ to: "/card/$customerToken", params: { customerToken: r.customerToken }, replace: true });
          return;
        }
        const list = await explore({ data: { q: "", city: "" } });
        if (active) { setShops(list.businesses as Shop[]); setState("pick_shop"); }
      } catch {
        if (active) setState("idle");
      }
    })();
    return () => { active = false; };
  }, [navigate, resolve, explore]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const r = await send({ data: { identifier } });
      if (r.status === "sent") { setMasked(r.maskedEmail); setState("sent"); }
      else if (r.status === "invalid") { toast.error("Enter a valid 10-digit mobile number or email."); setState("idle"); }
      else if (r.status === "error") { toast.error(r.message); setState("idle"); }
      else setState(r.status);
    } catch {
      toast.error("Something went wrong. Please try again.");
      setState("idle");
    }
  }

  async function pick(id: string) {
    try {
      const r = await join({ data: { businessId: id } });
      setCustomerSession(r.customerToken);
      navigate({ to: "/card/$customerToken", params: { customerToken: r.customerToken } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open this shop.");
    }
  }

  if (state === "pick_shop")
    return (
      <AuthShell title="Welcome! Pick a shop" subtitle="Your account is verified. Choose a shop to start collecting visits — or scan a shop's QR code.">
        <div className="grid max-h-96 gap-2 overflow-y-auto">
          {shops.length ? shops.map((s) => (
            <button key={s.id} type="button" onClick={() => pick(s.id)} className="surface p-3 text-left transition hover:bg-accent">
              <span className="block font-semibold">{s.name}</span>
              <span className="block text-xs text-muted-foreground">{[s.category, s.city].filter(Boolean).join(" · ")}</span>
            </button>
          )) : <p className="text-sm text-muted-foreground">No shops are listed yet.</p>}
        </div>
      </AuthShell>
    );

  if (state === "sent")
    return (
      <AuthShell title="Check your email" subtitle={`We sent a secure login link to ${masked}. Open it on this phone to log in.`}>
        <Button variant="outline" className="w-full" onClick={() => setState("idle")}>Use a different number or email</Button>
      </AuthShell>
    );

  return (
    <AuthShell
      title="Log in"
      subtitle="Customers & visitors — use your registered mobile number or email."
      footer={<>New here? <Link to="/signup" search={{ type: "customer" }} className="font-semibold text-primary">Create account</Link></>}
    >
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm font-semibold">
        <Link to="/login" className="rounded-lg py-2 text-center text-muted-foreground">Business Owner</Link>
        <span className="rounded-lg bg-background py-2 text-center shadow-sm">Customer / Visitor</span>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="identifier">Mobile number or email</Label>
          <Input id="identifier" required value={identifier} onChange={(e) => { setIdentifier(e.target.value); if (state !== "busy") setState("idle"); }} placeholder="98765 43210 or you@email.com" />
        </div>
        {state === "not_registered" ? (
          <div className="rounded-xl border border-border bg-accent p-4 text-center">
            <p className="font-semibold">You have not registered yet.</p>
            <Button asChild className="mt-3 w-full"><Link to="/signup" search={{ type: "customer" }}>Create Account</Link></Button>
          </div>
        ) : null}
        {state === "no_email" ? (
          <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
            This number has no email saved, so we can't verify it yet. Scan your shop's QR code once and add your email in Profile, then log in here.
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={state === "busy" || state === "checking"}>
          {state === "busy" ? "Checking…" : "Login"}
        </Button>
      </form>
    </AuthShell>
  );
}
