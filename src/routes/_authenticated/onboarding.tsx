import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Copy, Download, Printer } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { qrDataUrl, qrLink, downloadQrPng, printQr } from "@/lib/qr";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your business | Digital Udyam" },
      { name: "description", content: "Create your business, branch, loyalty program and QR code." },
      { property: "og:title", content: "Business setup | Digital Udyam" },
      { property: "og:description", content: "Launch your loyalty program in a few steps." },
    ],
  }),
  component: Onboarding,
});

const categories = [
  "Cafe",
  "Restaurant",
  "Salon",
  "Spa",
  "Gym",
  "Retail shop",
  "Bakery",
  "Car wash",
  "Clinic",
  "Other service",
];

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);

  const [biz, setBiz] = useState({
    name: "",
    category: "Cafe",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    logo_url: "",
  });
  const [branch, setBranch] = useState({
    name: "Main branch",
    address: "",
    latitude: "",
    longitude: "",
    opening_time: "09:00",
    closing_time: "21:00",
  });
  const [program, setProgram] = useState({
    name: "Stamp & Save",
    stamps_required: 10,
    reward_type: "FREE_PRODUCT",
    reward_description: "FREE Coffee",
    reward_expiry_days: 30,
  });

  async function saveBusiness() {
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("businesses")
      .insert({
        owner_id: auth.user!.id,
        name: biz.name,
        slug: slugify(biz.name),
        category: biz.category,
        phone: biz.phone || null,
        email: biz.email || null,
        website: biz.website || null,
        address: biz.address || null,
        city: biz.city || null,
        state: biz.state || null,
        pincode: biz.pincode || null,
        logo_url: biz.logo_url || null,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBusinessId(data.id);
    await supabase.from("business_staff").insert({
      business_id: data.id,
      user_id: auth.user!.id,
      full_name: auth.user!.user_metadata?.["full_name"] ?? "Owner",
      email: auth.user!.email ?? null,
      role: "BUSINESS_OWNER",
    });
    setStep(2);
  }

  async function saveBranch() {
    if (!businessId) return;
    setBusy(true);
    const { error } = await supabase.from("branches").insert({
      business_id: businessId,
      name: branch.name,
      address: branch.address || null,
      latitude: branch.latitude ? Number(branch.latitude) : null,
      longitude: branch.longitude ? Number(branch.longitude) : null,
      opening_time: branch.opening_time,
      closing_time: branch.closing_time,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep(3);
  }

  async function saveProgram() {
    if (!businessId) return;
    setBusy(true);
    const { error } = await supabase.from("loyalty_programs").insert({
      business_id: businessId,
      name: program.name,
      stamps_required: program.stamps_required,
      reward_type: program.reward_type,
      reward_description: program.reward_description,
      reward_expiry_days: program.reward_expiry_days,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    // Business QR + trial subscription
    const { data: qr, error: qrError } = await supabase
      .from("qr_codes")
      .insert({ business_id: businessId, label: "Business QR", qr_type: "BUSINESS" })
      .select("token")
      .single();

    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .eq("code", "STARTER")
      .maybeSingle();
    if (plan) {
      await supabase.from("subscriptions").insert({
        business_id: businessId,
        plan_id: plan.id,
        status: "TRIAL",
        trial_ends_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      });
    }
    await supabase.from("businesses").update({ onboarding_completed: true }).eq("id", businessId);
    setBusy(false);
    if (qrError) {
      toast.error(qrError.message);
      return;
    }
    const link = qrLink(qr.token);
    setQrValue(link);
    setQrImage(await qrDataUrl(link));
    setStep(4);
  }

  function finish() {
    queryClient.invalidateQueries();
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="brand-gradient min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Logo />
        <div className="mt-6 flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={
                s <= step ? "h-1.5 flex-1 rounded-full bg-primary" : "h-1.5 flex-1 rounded-full bg-border"
              }
            />
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          Step {step + 1} of 5 ·{" "}
          {["Business details", "First branch", "Loyalty program", "Your QR code"][step - 1]}
        </p>

        <div className="surface mt-5 p-6 shadow-lift">
          {step === 1 ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveBusiness();
              }}
            >
              <Field label="Business name" required value={biz.name} onChange={(v) => setBiz({ ...biz, name: v })} />
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={biz.category} onValueChange={(v) => setBiz({ ...biz, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone" value={biz.phone} onChange={(v) => setBiz({ ...biz, phone: v })} />
                <Field label="Business email" value={biz.email} onChange={(v) => setBiz({ ...biz, email: v })} />
              </div>
              <Field label="Website" value={biz.website} onChange={(v) => setBiz({ ...biz, website: v })} />
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea
                  rows={2}
                  value={biz.address}
                  onChange={(e) => setBiz({ ...biz, address: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City" value={biz.city} onChange={(v) => setBiz({ ...biz, city: v })} />
                <Field label="State" value={biz.state} onChange={(v) => setBiz({ ...biz, state: v })} />
                <Field label="Pincode" value={biz.pincode} onChange={(v) => setBiz({ ...biz, pincode: v })} />
              </div>
              <Field
                label="Logo image URL (optional)"
                value={biz.logo_url}
                onChange={(v) => setBiz({ ...biz, logo_url: v })}
              />
              <Button type="submit" className="w-full" disabled={busy}>
                Continue <ArrowRight className="ml-1 size-4" />
              </Button>
            </form>
          ) : null}

          {step === 2 ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveBranch();
              }}
            >
              <Field label="Branch name" required value={branch.name} onChange={(v) => setBranch({ ...branch, name: v })} />
              <div className="space-y-2">
                <Label>Branch address</Label>
                <Textarea
                  rows={2}
                  value={branch.address}
                  onChange={(e) => setBranch({ ...branch, address: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Latitude (optional)" value={branch.latitude} onChange={(v) => setBranch({ ...branch, latitude: v })} />
                <Field label="Longitude (optional)" value={branch.longitude} onChange={(v) => setBranch({ ...branch, longitude: v })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Opening time" type="time" value={branch.opening_time} onChange={(v) => setBranch({ ...branch, opening_time: v })} />
                <Field label="Closing time" type="time" value={branch.closing_time} onChange={(v) => setBranch({ ...branch, closing_time: v })} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Continue <ArrowRight className="ml-1 size-4" />
              </Button>
            </form>
          ) : null}

          {step === 3 ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveProgram();
              }}
            >
              <p className="rounded-xl bg-accent p-3 text-sm text-accent-foreground">
                Example: collect 10 stamps and get a FREE Coffee.
              </p>
              <Field label="Program name" required value={program.name} onChange={(v) => setProgram({ ...program, name: v })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Visit target</Label>
                  <Select
                    value={String(program.stamps_required)}
                    onValueChange={(v) => setProgram({ ...program, stamps_required: Number(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 visits</SelectItem>
                      <SelectItem value="10">10 visits</SelectItem>
                      <SelectItem value="20">20 visits</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reward type</Label>
                  <Select
                    value={program.reward_type}
                    onValueChange={(v) => setProgram({ ...program, reward_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FREE_PRODUCT">Free product</SelectItem>
                      <SelectItem value="DISCOUNT">Discount</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Field
                label="Reward description"
                required
                value={program.reward_description}
                onChange={(v) => setProgram({ ...program, reward_description: v })}
              />
              <Field
                label="Reward expiry (days)"
                type="number"
                value={String(program.reward_expiry_days)}
                onChange={(v) => setProgram({ ...program, reward_expiry_days: Number(v) })}
              />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Creating…" : "Create program & QR"}
              </Button>
            </form>
          ) : null}

          {step === 4 && qrValue ? (
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">
                <Check className="size-3.5" /> Your business is live
              </span>
              <h2 className="mt-4 text-lg font-bold">Your business QR code</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Print it and place it where customers pay. Every scan joins them to your loyalty
                program.
              </p>
              {qrImage ? (
                <img
                  src={qrImage}
                  alt="Business QR code"
                  className="mx-auto mt-5 w-56 rounded-2xl border border-border p-2"
                />
              ) : null}
              <p className="mt-3 break-all text-xs text-muted-foreground">{qrValue}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => downloadQrPng(qrValue, "business-qr.png")}>
                  <Download className="mr-1.5 size-4" /> PNG
                </Button>
                <Button variant="outline" onClick={() => qrImage && printQr(qrImage, "Scan to join our loyalty program")}>
                  <Printer className="mr-1.5 size-4" /> Print
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(qrValue);
                    toast.success("Link copied");
                  }}
                >
                  <Copy className="mr-1.5 size-4" /> Copy link
                </Button>
              </div>
              <Button className="mt-6 w-full" onClick={finish}>
                Go to dashboard <ArrowRight className="ml-1 size-4" />
              </Button>
            </div>
          ) : null}

          {step > 1 && step < 4 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground"
            >
              <ArrowLeft className="size-3.5" /> Back
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
