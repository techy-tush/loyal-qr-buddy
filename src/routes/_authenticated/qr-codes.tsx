import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, QrCode, Trash2 } from "lucide-react";
import { AppShell, EmptyState, PageHeader, StatCard } from "@/components/app/AppShell";
import { QrCard } from "@/components/qr/QrCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/qr-codes")({
  head: () => ({
    meta: [
      { title: "QR codes | Digital Udyam" },
      {
        name: "description",
        content: "Create, print and track loyalty QR codes for every branch and campaign.",
      },
      { property: "og:title", content: "QR codes | Digital Udyam" },
      {
        property: "og:description",
        content: "Generate secure QR codes customers scan to join your loyalty program.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <QrCodesPage />
    </AppShell>
  ),
});

const QR_TYPES = ["BUSINESS", "BRANCH", "CAMPAIGN", "MENU", "LOYALTY"] as const;
type QrType = (typeof QR_TYPES)[number];

function QrCodesPage() {
  const { business, branches } = useBusiness();
  const businessId = business!.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [qrType, setQrType] = useState<QrType>("BUSINESS");
  const [branch, setBranch] = useState("none");

  const codes = useQuery({
    queryKey: ["qr-codes", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("id, label, qr_type, token, branch_id, scan_count, is_active, created_at")
        .eq("business_id", businessId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (label.trim().length < 2) throw new Error("Give this QR code a name.");
      const { error } = await supabase.from("qr_codes").insert({
        business_id: businessId,
        branch_id: branch === "none" ? null : branch,
        label: label.trim(),
        qr_type: qrType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("QR code created");
      setOpen(false);
      setLabel("");
      setQrType("BUSINESS");
      setBranch("none");
      queryClient.invalidateQueries({ queryKey: ["qr-codes", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("qr_codes").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["qr-codes", businessId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("qr_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("QR code deleted");
      queryClient.invalidateQueries({ queryKey: ["qr-codes", businessId] });
    },
    onError: () =>
      toast.error("This QR code already has scans. Switch it off instead of deleting it."),
  });

  const list = codes.data ?? [];
  const totalScans = list.reduce((s, c) => s + (c.scan_count ?? 0), 0);

  const createDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 size-4" /> New QR code
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New QR code</DialogTitle>
          <DialogDescription>
            Customers who scan this code join your loyalty program and collect stamps.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="qr-label">Name</Label>
            <Input
              id="qr-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Counter QR"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={qrType} onValueChange={(v) => setQrType(v as QrType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QR_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Branch</Label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific branch</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create QR code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div>
      <PageHeader
        title="QR codes"
        description="Print these at your counter, tables or entrance."
        action={createDialog}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="QR codes" value={list.length} icon={QrCode} />
        <StatCard label="Total scans" value={totalScans} />
        <StatCard label="Active codes" value={list.filter((c) => c.is_active).length} />
      </div>

      {codes.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="No QR codes yet"
          description="Create your first QR code and share it to get your first customer."
          action={createDialog}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((code) => (
            <div key={code.id} className="surface p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{code.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {code.qr_type.charAt(0) + code.qr_type.slice(1).toLowerCase()} ·{" "}
                    {branches.find((b) => b.id === code.branch_id)?.name ?? "All branches"} ·{" "}
                    {code.scan_count ?? 0} scans
                  </p>
                </div>
                <Badge variant={code.is_active ? "default" : "secondary"}>
                  {code.is_active ? "Active" : "Off"}
                </Badge>
              </div>

              <QrCard token={code.token} title={code.label} />

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={code.is_active}
                    onCheckedChange={(v) => toggle.mutate({ id: code.id, is_active: v })}
                  />
                  Accepting scans
                </label>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this QR code?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Anyone scanning a printed copy of “{code.label}” will see an error.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove.mutate(code.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
