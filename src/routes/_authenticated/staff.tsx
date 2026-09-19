import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, UserCog } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff | Digital Udyam" },
      { name: "description", content: "Invite managers and staff and control what they can do." },
      { property: "og:title", content: "Staff & permissions | Digital Udyam" },
      { property: "og:description", content: "Role-based access for every team member." },
    ],
  }),
  component: () => (
    <AppShell>
      <StaffPage />
    </AppShell>
  ),
});

const roleLabels: Record<string, string> = {
  BUSINESS_OWNER: "Owner",
  BUSINESS_MANAGER: "Manager",
  STAFF: "Staff",
};

function StaffPage() {
  const { business, branches } = useBusiness();
  const businessId = business!.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "STAFF",
    branch_id: "none",
  });

  const staff = useQuery({
    queryKey: ["staff", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_staff")
        .select("*, branches(name)")
        .eq("business_id", businessId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addStaff = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("business_staff").insert({
        business_id: businessId,
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        role: form.role as "BUSINESS_MANAGER" | "STAFF",
        branch_id: form.branch_id === "none" ? null : form.branch_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Team member added");
      setForm({ full_name: "", email: "", phone: "", role: "STAFF", branch_id: "none" });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["staff", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("business_staff").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff", businessId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeStaff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Team member removed");
      queryClient.invalidateQueries({ queryKey: ["staff", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Staff"
        description="Managers run a branch, staff issue stamps and redeem rewards."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1.5 size-4" /> Add team member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add team member</DialogTitle>
                <DialogDescription>
                  Add them here with the email they will sign up with. Once they create an account with
                  that email, their access is linked automatically.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  addStaff.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STAFF">Staff</SelectItem>
                        <SelectItem value="BUSINESS_MANAGER">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">All branches</SelectItem>
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
                  <Button type="submit" disabled={addStaff.isPending}>
                    {addStaff.isPending ? "Saving…" : "Add member"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {staff.isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (staff.data ?? []).length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No team members yet"
          description="Add a manager or staff member so they can issue stamps at the counter."
        />
      ) : (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.data!.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.email ?? "—"}
                    {s.phone ? ` · ${s.phone}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.role === "STAFF" ? "outline" : "default"}>
                      {roleLabels[s.role] ?? s.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(s as unknown as { branches?: { name?: string } }).branches?.name ?? "All branches"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={s.is_active}
                      onCheckedChange={(v) => toggleActive.mutate({ id: s.id, isActive: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {s.role === "BUSINESS_OWNER" ? null : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeStaff.mutate(s.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
