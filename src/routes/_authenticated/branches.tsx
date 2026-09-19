import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, Trash2 } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/app/AppShell";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/branches")({
  head: () => ({
    meta: [
      { title: "Branches | Digital Udyam" },
      { name: "description", content: "Add and manage every branch of your business." },
      { property: "og:title", content: "Branches | Digital Udyam" },
      { property: "og:description", content: "Multi-branch loyalty with per-branch QR codes and staff." },
    ],
  }),
  component: () => (
    <AppShell>
      <BranchesPage />
    </AppShell>
  ),
});

const emptyForm = {
  name: "",
  address: "",
  phone: "",
  latitude: "",
  longitude: "",
  opening_time: "09:00",
  closing_time: "21:00",
};

function BranchesPage() {
  const { business, refetch } = useBusiness();
  const businessId = business!.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const branches = useQuery({
    queryKey: ["branches-full", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const plan = useQuery({
    queryKey: ["subscription-plan", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, trial_ends_at, plans(name, max_branches)")
        .eq("business_id", businessId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const maxBranches = plan.data?.plans?.max_branches ?? 1;
  const atLimit = (branches.data?.length ?? 0) >= maxBranches;

  const createBranch = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("branches").insert({
        business_id: businessId,
        name: form.name,
        address: form.address || null,
        phone: form.phone || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        opening_time: form.opening_time,
        closing_time: form.closing_time,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branch added");
      setForm(emptyForm);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["branches-full", businessId] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("branches").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches-full", businessId] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeBranch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branch removed");
      queryClient.invalidateQueries({ queryKey: ["branches-full", businessId] });
      refetch();
    },
    onError: () =>
      toast.error("This branch has activity linked to it. Deactivate it instead of deleting."),
  });

  const addDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={atLimit}>
          <Plus className="mr-1.5 size-4" /> Add branch
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a branch</DialogTitle>
          <DialogDescription>
            Each branch gets its own QR codes, staff and analytics.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createBranch.mutate();
          }}
        >
          <div className="space-y-2">
            <Label>Branch name</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Latitude</Label>
              <Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Longitude</Label>
              <Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Opening time</Label>
              <Input
                type="time"
                value={form.opening_time}
                onChange={(e) => setForm({ ...form, opening_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Closing time</Label>
              <Input
                type="time"
                value={form.closing_time}
                onChange={(e) => setForm({ ...form, closing_time: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createBranch.isPending}>
              {createBranch.isPending ? "Saving…" : "Add branch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <PageHeader
        title="Branches"
        description={
          plan.data
            ? `${branches.data?.length ?? 0} of ${maxBranches} branches used on the ${plan.data.plans?.name ?? "current"} plan.`
            : "Manage your locations."
        }
        action={addDialog}
      />

      {atLimit ? (
        <p className="mb-4 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          You have reached the branch limit for your plan. Upgrade to add more locations.
        </p>
      ) : null}

      {branches.isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (branches.data ?? []).length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No branches yet"
          description="Add your first location so customers and staff can be linked to it."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.data!.map((b) => (
            <div key={b.id} className="surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{b.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{b.address ?? "No address added"}</p>
                </div>
                <Badge variant={b.is_active ? "default" : "secondary"}>
                  {b.is_active ? "Active" : "Paused"}
                </Badge>
              </div>
              <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
                <div>Phone: {b.phone ?? "—"}</div>
                <div>
                  Hours: {b.opening_time ?? "—"} – {b.closing_time ?? "—"}
                </div>
                <div>
                  GPS: {b.latitude ?? "—"}, {b.longitude ?? "—"}
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <Switch
                    checked={b.is_active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: b.id, isActive: v })}
                  />
                  Accepting visits
                </label>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {b.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This cannot be undone. Branches with visits or QR codes should be paused instead.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeBranch.mutate(b.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
