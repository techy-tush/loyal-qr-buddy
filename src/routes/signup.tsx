import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useServerFn } from "@tanstack/react-start";
import { Store, User } from "lucide-react";
import { sendCustomerSignupLink } from "@/lib/customer-auth.functions";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your business account | Digital Udyam" },
      {
        name: "description",
        content:
          "Create your Digital Udyam business account and launch QR loyalty in minutes. Plans from ₹699 for 6 months.",
      },
      { property: "og:title", content: "Create your business account | Digital Udyam" },
      { property: "og:description", content: "Launch QR loyalty for your business in minutes." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { type?: "business" | "customer" } => {
    const t = s["type"];
    return t === "business" || t === "customer" ? { type: t } : {};
  },
  component: SignupPage,
});

function SignupPage() {
  const { type } = Route.useSearch();
  if (type === "business") return <BusinessSignup />;
  if (type === "customer") return <CustomerSignup />;
  return (
    <AuthShell
      title="Create an account"
      subtitle="Choose who you are."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-primary">Log in</Link></>}
    >
      <div className="grid gap-3">
        <Link to="/signup" search={{ type: "customer" }} className="surface flex items-center gap-4 p-4 transition hover:bg-accent">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-primary"><User className="size-6" /></span>
          <span><span className="block font-bold">Customer</span><span className="block text-xs text-muted-foreground">Collect visits, get rewards and see offers from shops near you.</span></span>
        </Link>
        <Link to="/signup" search={{ type: "business" }} className="surface flex items-center gap-4 p-4 transition hover:bg-accent">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Store className="size-6" /></span>
          <span><span className="block font-bold">Businessman / Business Owner</span><span className="block text-xs text-muted-foreground">Register your shop, run loyalty, offers and pick a plan (₹699 / 6 months or ₹999 / 12 months).</span></span>
        </Link>
      </div>
    </AuthShell>
  );
}

function CustomerSignup() {
  const send = useServerFn(sendCustomerSignupLink);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", dob: "" });
  const [state, setState] = useState<"idle" | "busy" | "sent" | "exists">("idle");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const r = await send({ data: form });
      if (r.status === "error") { toast.error(r.message); setState("idle"); return; }
      setState(r.status);
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/^\[.*?\]\s*/, "") : "Please check your details.");
      setState("idle");
    }
  }
  if (state === "sent")
    return (
      <AuthShell title="Check your email" subtitle={`We sent a verification link to ${form.email}. Open it on this phone to finish creating your account.`}>
        <Button asChild variant="outline" className="w-full"><Link to="/customer-login">Back to customer login</Link></Button>
      </AuthShell>
    );
  if (state === "exists")
    return (
      <AuthShell title="You already have an account" subtitle="This mobile number or email is already registered. Please log in instead.">
        <Button asChild className="w-full"><Link to="/customer-login">Customer login</Link></Button>
      </AuthShell>
    );
  return (
    <AuthShell
      title="Create customer account"
      subtitle="We'll email you a link to verify it's really you."
      footer={<>Already registered? <Link to="/customer-login" className="font-semibold text-primary">Customer login</Link></>}
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2"><Label htmlFor="c_name">Full name</Label><Input id="c_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="c_email">Email</Label><Input id="c_email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="c_phone">Mobile number</Label><Input id="c_phone" inputMode="tel" required placeholder="98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="c_dob">Date of birth (optional)</Label><Input id="c_dob" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
        <Button type="submit" className="w-full" disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Create account"}</Button>
      </form>
    </AuthShell>
  );
}

function BusinessSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", mobile: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: form.full_name, mobile: form.mobile },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Check your email to confirm your account, then log in.");
      navigate({ to: "/login" });
      return;
    }
    toast.success("Account created! Let's set up your business.");
    navigate({ to: "/onboarding" });
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-up failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/onboarding" });
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Step 1 of 5 — your account. Next you'll add your business, branch, loyalty program and QR code."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary">
            Log in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSignup}>
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile</Label>
          <Input
            id="mobile"
            required
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      {/* Google sign-in disabled for now; re-enable later via handleGoogle. */}
    </AuthShell>
  );
}
