import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in | Digital Udyam" },
      { name: "description", content: "Log in to your Digital Udyam business dashboard." },
      { property: "og:title", content: "Log in | Digital Udyam" },
      { property: "og:description", content: "Access your QR loyalty dashboard." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    const { data: roles } = await supabase.from("user_roles").select("role");
    const isAdmin = (roles ?? []).some((r) => r.role === "SUPER_ADMIN");
    navigate({ to: isAdmin ? "/admin" : "/dashboard" });
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Welcome back to your loyalty dashboard."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" search={{ type: undefined }} className="font-semibold text-primary">
            Create an account
          </Link>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm font-semibold">
        <span className="rounded-lg bg-background py-2 text-center shadow-sm">Business Owner</span>
        <Link to="/customer-login" className="rounded-lg py-2 text-center text-muted-foreground">Customer / Visitor</Link>
      </div>
      <form className="space-y-4" onSubmit={handleLogin}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" className="w-full" onClick={handleGoogle}>
        Continue with Google
      </Button>
      <div className="mt-5 text-center">
        <Link to="/forgot-password" className="text-xs text-muted-foreground underline">
          Forgot your password?
        </Link>
      </div>
    </AuthShell>
  );
}
