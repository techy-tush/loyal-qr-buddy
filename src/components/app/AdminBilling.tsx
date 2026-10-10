import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  convertPaymentToManual,
  createBusinessUser,
  getSubscriptionHistory,
  listInvoicesAdmin,
  recordManualPayment,
  saveSellerDetails,
  updateSubscriptionAdmin,
} from "@/lib/admin-billing.functions";
import { normalizeIndianPhone } from "@/lib/validation";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";

const today = () => new Date().toISOString().slice(0, 10);
const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function usePlansList() {
  return useQuery({
    queryKey: ["admin-plan-list"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("id, name, price_yearly, duration_months, contact_only").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/* ----------------------------- Create user ----------------------------- */
export function CreateUserTab() {
  const plans = usePlansList();
  const fn = useServerFn(createBusinessUser);
  const qc = useQueryClient();
  const blank = {
    fullName: "", businessName: "", email: "", mobile: "", category: "", address: "", city: "",
    planId: "", paymentMethod: "MANUAL" as "UPI" | "MANUAL", paymentStatus: "PENDING" as "PENDING" | "PAID",
    amount: "", paymentMode: "Cash", reference: "", activationDate: today(), expiryDate: "", notes: "",
  };
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const m = useMutation({
    mutationFn: () => {
      if (!normalizeIndianPhone(f.mobile)) throw new Error("Enter a valid Indian mobile number.");
      return fn({ data: { ...f, amount: Number(f.amount || 0) } });
    },
    onSuccess: () => {
      toast.success("Account created. A password-setup email has been sent.");
      setF(blank);
      qc.invalidateQueries({ queryKey: ["admin-businesses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form className="surface max-w-3xl space-y-5 p-5" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <div>
        <h2 className="text-lg font-bold">Create a business owner</h2>
        <p className="text-sm text-muted-foreground">The owner gets an email to set their own password. Business, subscription and the shop QR are created automatically.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *"><Input required value={f.fullName} onChange={set("fullName")} /></Field>
        <Field label="Business name *"><Input required value={f.businessName} onChange={set("businessName")} /></Field>
        <Field label="Email *"><Input required type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Mobile (India) *"><Input required inputMode="tel" placeholder="+91 98xxxxxxxx" value={f.mobile} onChange={set("mobile")} /></Field>
        <Field label="Category"><Input placeholder="Cafe, Salon, Car wash…" value={f.category} onChange={set("category")} /></Field>
        <Field label="City"><Input value={f.city} onChange={set("city")} /></Field>
        <div className="sm:col-span-2"><Field label="Address"><Input value={f.address} onChange={set("address")} /></Field></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan *">
          <select required className={sel} value={f.planId} onChange={(e) => {
            const p = plans.data?.find((x) => x.id === e.target.value);
            setF((s) => ({ ...s, planId: e.target.value, amount: p && !p.contact_only ? String(p.price_yearly) : s.amount }));
          }}>
            <option value="">Choose plan</option>
            {plans.data?.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.duration_months} months</option>)}
          </select>
        </Field>
        <Field label="Amount (₹)"><Input type="number" min={0} value={f.amount} onChange={set("amount")} /></Field>
        <Field label="Payment method">
          <select className={sel} value={f.paymentMethod} onChange={(e) => setF((s) => ({ ...s, paymentMethod: e.target.value as "UPI" | "MANUAL", paymentStatus: e.target.value === "UPI" ? "PENDING" : s.paymentStatus }))}>
            <option value="MANUAL">Manual (admin only)</option>
            <option value="UPI">UPI — owner pays later</option>
          </select>
        </Field>
        <Field label="Payment status">
          <select className={sel} value={f.paymentStatus} disabled={f.paymentMethod === "UPI"} onChange={(e) => setF((s) => ({ ...s, paymentStatus: e.target.value as "PENDING" | "PAID" }))}>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid — I have verified it</option>
          </select>
        </Field>
        {f.paymentMethod === "MANUAL" ? (
          <>
            <Field label="Payment mode"><Input placeholder="Cash, Bank transfer, Cheque" value={f.paymentMode} onChange={set("paymentMode")} /></Field>
            <Field label="Reference no."><Input value={f.reference} onChange={set("reference")} /></Field>
          </>
        ) : null}
        <Field label="Activation date"><Input type="date" value={f.activationDate} onChange={set("activationDate")} /></Field>
        <Field label="Expiry date (blank = plan duration)"><Input type="date" value={f.expiryDate} onChange={set("expiryDate")} /></Field>
        <div className="sm:col-span-2"><Field label="Admin notes"><Textarea rows={2} value={f.notes} onChange={set("notes")} /></Field></div>
      </div>
      <Button type="submit" disabled={m.isPending}>{m.isPending ? "Creating…" : "Create account"}</Button>
    </form>
  );
}

/* ---------------------- Manage one subscription ---------------------- */
export function ManageSubscriptionDialog({ sub, onClose }: { sub: any | null; onClose: () => void }) {
  const plans = usePlansList();
  const fn = useServerFn(updateSubscriptionAdmin);
  const histFn = useServerFn(getSubscriptionHistory);
  const qc = useQueryClient();
  const businessId: string | undefined = sub?.businesses?.id ?? sub?.business_id;
  const [f, setF] = useState<any>(null);
  const history = useQuery({ queryKey: ["sub-history", businessId], enabled: Boolean(businessId), queryFn: () => histFn({ data: { businessId: businessId! } }) });
  const form = f ?? {
    planId: sub?.plans?.id ?? "", status: sub?.status === "TRIAL" ? "PAST_DUE" : sub?.status ?? "PAST_DUE",
    periodEnd: sub?.current_period_end?.slice(0, 10) ?? "", customMaxBranches: sub?.custom_max_branches ?? "",
    customPrice: sub?.custom_price ?? "", reason: "",
  };
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...form, [k]: e.target.value });
  const m = useMutation({
    mutationFn: () => fn({ data: {
      businessId: businessId!, planId: form.planId, status: form.status, periodEnd: form.periodEnd, reason: form.reason,
      customMaxBranches: form.customMaxBranches === "" ? null : Number(form.customMaxBranches),
      customPrice: form.customPrice === "" ? null : Number(form.customPrice),
    } }),
    onSuccess: () => { toast.success("Subscription updated."); qc.invalidateQueries({ queryKey: ["admin-subscriptions"] }); setF(null); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const renew = (months: number) => {
    const base = new Date(Math.max(Date.now(), form.periodEnd ? new Date(form.periodEnd).getTime() : 0));
    base.setMonth(base.getMonth() + months);
    setF({ ...form, periodEnd: base.toISOString().slice(0, 10), status: "ACTIVE" });
  };
  return (
    <Dialog open={Boolean(sub)} onOpenChange={(o) => { if (!o) { setF(null); onClose(); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{sub?.businesses?.name ?? "Subscription"}</DialogTitle>
          <DialogDescription>Change plan, dates, branch limit or status. A reason is saved in history.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plan">
            <select className={sel} value={form.planId} onChange={set("planId")}>
              {plans.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={sel} value={form.status} onChange={set("status")}>
              <option value="ACTIVE">Active</option><option value="PAST_DUE">Payment pending</option>
              <option value="SUSPENDED">Suspended</option><option value="CANCELLED">Cancelled</option>
            </select>
          </Field>
          <Field label="Expiry date"><Input type="date" value={form.periodEnd} onChange={set("periodEnd")} /></Field>
          <Field label="Custom branch limit"><Input type="number" min={1} placeholder="Plan default" value={form.customMaxBranches} onChange={set("customMaxBranches")} /></Field>
          <Field label="Custom price (₹)"><Input type="number" min={0} placeholder="Plan price" value={form.customPrice} onChange={set("customPrice")} /></Field>
          <div className="flex items-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => renew(6)}>+6 months</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => renew(12)}>+12 months</Button>
          </div>
          <div className="sm:col-span-2"><Field label="Reason *"><Input value={form.reason} onChange={set("reason")} placeholder="e.g. Paid cash at office" /></Field></div>
        </div>
        <Button disabled={m.isPending || form.reason.trim().length < 3} onClick={() => m.mutate()}>Save changes</Button>
        <div className="mt-2">
          <p className="text-xs font-semibold text-muted-foreground">History</p>
          {(history.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No changes yet.</p> : (
            <ul className="mt-1 space-y-1 text-xs">
              {history.data!.map((h: any) => (
                <li key={h.id} className="rounded-md bg-muted/50 p-2">
                  <b>{h.action}</b> · {new Date(h.created_at).toLocaleString()} — {h.reason ?? ""}
                  <br /><span className="text-muted-foreground">{h.old_value?.status ?? "—"} → {h.new_value?.status ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------- Record / convert manual ----------------------- */
export function ManualPaymentDialog({ open, onClose, convert }: { open: boolean; onClose: () => void; convert?: any | null }) {
  const plans = usePlansList();
  const recordFn = useServerFn(recordManualPayment);
  const convertFn = useServerFn(convertPaymentToManual);
  const qc = useQueryClient();
  const businesses = useQuery({
    queryKey: ["admin-biz-mini"], enabled: open && !convert,
    queryFn: async () => (await supabase.from("businesses").select("id, name").order("name").limit(500)).data ?? [],
  });
  const [f, setF] = useState({ businessId: "", target: "", amount: "", paidAt: today(), mode: "Cash", reference: "", notes: "", markPaid: true });
  const set = (k: string) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const m = useMutation({
    mutationFn: () => {
      if (convert) return convertFn({ data: { paymentId: convert.id, mode: f.mode, reference: f.reference, paidAt: f.paidAt, reason: f.notes, markPaid: f.markPaid } });
      const isAddon = f.target === "REVIEW_WRITER" || f.target === "DIGITAL_MENU";
      return recordFn({ data: {
        businessId: f.businessId, planId: isAddon ? null : f.target, addonCode: isAddon ? (f.target as any) : null,
        amount: Number(f.amount), paidAt: f.paidAt, mode: f.mode, reference: f.reference, notes: f.notes, markPaid: f.markPaid,
      } });
    },
    onSuccess: () => { toast.success(f.markPaid ? "Payment verified and activated." : "Payment saved."); qc.invalidateQueries({ queryKey: ["admin-payments"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{convert ? "Convert to manual payment" : "Record manual payment"}</DialogTitle>
          <DialogDescription>
            {convert ? `Original UPI reference ${convert.provider_ref ?? "—"} is kept in the audit log.` : "Only record money you have actually received."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {!convert ? (
            <>
              <Field label="Business">
                <select className={sel} value={f.businessId} onChange={set("businessId")}>
                  <option value="">Choose</option>
                  {businesses.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="For">
                <select className={sel} value={f.target} onChange={(e) => {
                  const p = plans.data?.find((x) => x.id === e.target.value);
                  setF((s) => ({ ...s, target: e.target.value, amount: p ? String(p.price_yearly) : e.target.value === "REVIEW_WRITER" ? "189" : e.target.value === "DIGITAL_MENU" ? "149" : s.amount }));
                }}>
                  <option value="">Choose</option>
                  {plans.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  <option value="REVIEW_WRITER">Add-on: AI Review Writer</option>
                  <option value="DIGITAL_MENU">Add-on: Digital Menu</option>
                </select>
              </Field>
              <Field label="Amount (₹)"><Input type="number" value={f.amount} onChange={set("amount")} /></Field>
            </>
          ) : null}
          <Field label="Payment date"><Input type="date" value={f.paidAt} onChange={set("paidAt")} /></Field>
          <Field label="Mode"><Input value={f.mode} onChange={set("mode")} placeholder="Cash / Bank transfer" /></Field>
          <Field label="Reference"><Input value={f.reference} onChange={set("reference")} /></Field>
          <div className="sm:col-span-2"><Field label={convert ? "Reason *" : "Notes"}><Textarea rows={2} value={f.notes} onChange={set("notes")} /></Field></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Switch checked={f.markPaid} onCheckedChange={(v) => setF((s) => ({ ...s, markPaid: v }))} /> I have verified this money is received — mark paid
          </label>
        </div>
        <Button disabled={m.isPending} onClick={() => m.mutate()}>Save</Button>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Invoices ------------------------------ */
export function InvoicesTab() {
  const [page, setPage] = useState(0);
  const fn = useServerFn(listInvoicesAdmin);
  const q = useQuery({ queryKey: ["admin-invoices", page], queryFn: () => fn({ data: { page } }) });
  return (
    <>
      <SellerDetailsCard />
      {q.isLoading ? <Skeleton className="h-40 w-full rounded-2xl" /> : (q.data?.rows.length ?? 0) === 0 ? (
        <p className="surface p-5 text-sm text-muted-foreground">No invoices yet. They are created when a payment is verified.</p>
      ) : (
        <div className="space-y-2">
          {q.data!.rows.map((inv: any) => (
            <div key={inv.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{inv.invoice_number} · {new Date(inv.created_at).toLocaleDateString()}</p>
                <p className="font-semibold">{inv.businesses?.name} — {inv.item_name}</p>
                <p className="text-xs text-muted-foreground">₹{Number(inv.total).toLocaleString("en-IN")} · {inv.method} · {inv.reference ?? "no ref"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => downloadInvoicePdf(inv)}>Download PDF</Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={(page + 1) * 20 >= (q.data?.total ?? 0)} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </>
  );
}

function SellerDetailsCard() {
  const fn = useServerFn(saveSellerDetails);
  const q = useQuery({
    queryKey: ["seller-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("key, value").like("key", "seller_%");
      const g = (k: string) => data?.find((x) => x.key === k)?.value ?? "";
      return { name: g("seller_name") || "Digital Udyam", address: g("seller_address"), gstin: g("seller_gstin"), taxRate: g("seller_tax_rate") || "0", email: g("seller_email"), phone: g("seller_phone") };
    },
  });
  const [f, setF] = useState<any>(null);
  const form = f ?? q.data;
  const m = useMutation({
    mutationFn: () => fn({ data: { ...form, taxRate: Number(form.taxRate || 0) } }),
    onSuccess: () => toast.success("Seller details saved."),
    onError: (e: Error) => toast.error(e.message),
  });
  if (!form) return null;
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...form, [k]: e.target.value });
  return (
    <div className="surface mb-4 space-y-3 p-5">
      <h3 className="font-bold">Seller details on invoices</h3>
      <p className="text-xs text-muted-foreground">GST is shown only when you add a GSTIN and tax rate. Prices are treated as tax-inclusive.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name"><Input value={form.name} onChange={set("name")} /></Field>
        <Field label="GSTIN (optional)"><Input value={form.gstin} onChange={set("gstin")} /></Field>
        <Field label="GST rate %"><Input type="number" value={form.taxRate} onChange={set("taxRate")} /></Field>
        <Field label="Email"><Input value={form.email} onChange={set("email")} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
        <Field label="Address"><Input value={form.address} onChange={set("address")} /></Field>
      </div>
      <Button size="sm" disabled={m.isPending} onClick={() => m.mutate()}>Save</Button>
    </div>
  );
}
