import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setCustomerSession } from "@/lib/customer-session";
import { loginCustomerByPhone } from "@/lib/customer-auth.functions";

export const Route = createFileRoute("/customer-login")({
  head: () => ({
    meta: [
      { title: "Customer login | Digital Udyam" },
      { name: "description", content: "Customers and visitors: log in with your mobile number to see your loyalty cards and rewards." },
      { property: "og:title", content: "Customer login | Digital Udyam" },
      { property: "og:description", content: "See your shops, visits, rewards and offers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerLogin,
});

function CustomerLogin() {
  const navigate = useNavigate();
  const login = useServerFn(loginCustomerByPhone);
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "not_registered">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const r = await login({ data: { phone } });
      if (r.status === "ok") {
        setCustomerSession(r.customerToken);
        navigate({ to: "/card/$customerToken", params: { customerToken: r.customerToken } });
        return;
      }
      if (r.status === "invalid") {
        toast.error("Enter a valid 10-digit mobile number.");
        setState("idle");
        return;
      }
      setState("not_registered");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setState("idle");
    }
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Customers & visitors — use your registered mobile number."
      footer={<>New here? <Link to="/signup" search={{ type: "customer" }} className="font-semibold text-primary">Create account</Link></>}
    >
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm font-semibold">
        <Link to="/login" className="rounded-lg py-2 text-center text-muted-foreground">Business Owner</Link>
        <span className="rounded-lg bg-background py-2 text-center shadow-sm">Customer / Visitor</span>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="phone">Mobile number</Label>
          <Input id="phone" required inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); if (state !== "busy") setState("idle"); }} placeholder="98765 43210" />
        </div>
        {state === "not_registered" ? (
          <div className="rounded-xl border border-border bg-accent p-4 text-center">
            <p className="font-semibold">You have not registered yet.</p>
            <Button asChild className="mt-3 w-full"><Link to="/signup" search={{ type: "customer" }}>Create Account</Link></Button>
          </div>
        ) : null}
        <Button type="submit" className="w-full" disabled={state === "busy"}>
          {state === "busy" ? "Checking…" : "Login"}
        </Button>
      </form>
    </AuthShell>
  );
}
