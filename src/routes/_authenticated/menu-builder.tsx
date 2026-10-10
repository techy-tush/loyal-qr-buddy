import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/menu-builder")({
  head: () => ({
    meta: [
      { title: "Digital menu | Digital Udyam" },
      { name: "description", content: "Build your mobile digital menu with categories, prices and photos." },
      { property: "og:title", content: "Digital menu | Digital Udyam" },
      { property: "og:description", content: "A beautiful QR menu for your restaurant or cafe." },
    ],
  }),
  component: () => (
    <AppShell>
      <MenuBuilder />
    </AppShell>
  ),
});

function MenuBuilder() {
  const { business } = useBusiness();
  const businessId = business!.id;
  const qc = useQueryClient();
  const [catName, setCatName] = useState("");

  const active = useQuery({
    queryKey: ["addon-active", businessId, "DIGITAL_MENU"],
    queryFn: async () => {
      const { data } = await supabase.rpc("addon_active", { _business_id: businessId, _code: "DIGITAL_MENU" });
      return Boolean(data);
    },
  });
  const menu = useQuery({
    queryKey: ["menu", businessId],
    queryFn: async () => {
      const [c, i] = await Promise.all([
        supabase.from("menu_categories").select("id, name, sort_order").eq("business_id", businessId).order("sort_order"),
        supabase.from("menu_items").select("id, category_id, name, description, price, image_url, is_available").eq("business_id", businessId).order("sort_order"),
      ]);
      if (c.error) throw c.error;
      if (i.error) throw i.error;
      return { categories: c.data, items: i.data };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["menu", businessId] });
  const onErr = (e: Error) => toast.error(e.message);

  const addCat = useMutation({
    mutationFn: async () => {
      if (catName.trim().length < 2) throw new Error("Enter a category name");
      const { error } = await supabase.from("menu_categories").insert({ business_id: businessId, name: catName.trim(), sort_order: menu.data?.categories.length ?? 0 });
      if (error) throw error;
    },
    onSuccess: () => { setCatName(""); refresh(); },
    onError: onErr,
  });
  const delCat = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("menu_items").delete().eq("category_id", id);
      const { error } = await supabase.from("menu_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh, onError: onErr,
  });
  const addItem = useMutation({
    mutationFn: async (v: { category_id: string; name: string; price: number; description: string; image_url: string }) => {
      if (v.name.trim().length < 1) throw new Error("Enter item name");
      if (!(v.price >= 0)) throw new Error("Enter a valid price");
      const { error } = await supabase.from("menu_items").insert({ business_id: businessId, ...v, description: v.description || null, image_url: v.image_url || null });
      if (error) throw error;
    },
    onSuccess: refresh, onError: onErr,
  });
  const toggleItem = useMutation({
    mutationFn: async ({ id, is_available }: { id: string; is_available: boolean }) => {
      const { error } = await supabase.from("menu_items").update({ is_available }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh, onError: onErr,
  });
  const delItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh, onError: onErr,
  });

  return (
    <>
      <PageHeader
        title="Digital menu"
        description="Categories and items your customers see after scanning your QR."
        action={active.data ? (
          <Button variant="outline" asChild><a href={`/menu/${business!.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 size-4" /> View menu</a></Button>
        ) : null}
      />
      {active.data === false ? (
        <div className="surface mb-5 border-warning/40 p-4 text-sm">
          The Digital Menu add-on is not active, so customers can't see your menu.{" "}
          <Link to="/addons" className="font-semibold text-primary underline">Activate it for ₹149/year</Link>
        </div>
      ) : null}
      <form className="surface mb-5 flex gap-2 p-4" onSubmit={(e) => { e.preventDefault(); addCat.mutate(); }}>
        <Input placeholder="New category (e.g. Coffee, Desserts)" value={catName} onChange={(e) => setCatName(e.target.value)} />
        <Button type="submit" disabled={addCat.isPending}><Plus className="mr-1 size-4" /> Add</Button>
      </form>
      {menu.isLoading ? <Skeleton className="h-60 rounded-2xl" /> : (menu.data?.categories.length ?? 0) === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No menu yet" description="Add your first category, then add items with prices." />
      ) : (
        <div className="space-y-4">
          {menu.data!.categories.map((c) => (
            <div key={c.id} className="surface p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{c.name}</h3>
                <Button variant="ghost" size="icon" onClick={() => confirm(`Delete ${c.name} and its items?`) && delCat.mutate(c.id)}><Trash2 className="size-4" /></Button>
              </div>
              <ul className="mt-2 divide-y divide-border">
                {menu.data!.items.filter((i) => i.category_id === c.id).map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2">
                    {i.image_url ? <img src={i.image_url} alt="" className="size-10 rounded-lg object-cover" /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{i.name}</p>
                      {i.description ? <p className="truncate text-xs text-muted-foreground">{i.description}</p> : null}
                    </div>
                    <span className="text-sm font-semibold">₹{Number(i.price)}</span>
                    <Switch checked={i.is_available} onCheckedChange={(v) => toggleItem.mutate({ id: i.id, is_available: v })} />
                    <Button variant="ghost" size="icon" onClick={() => delItem.mutate(i.id)}><Trash2 className="size-4" /></Button>
                  </li>
                ))}
              </ul>
              <form
                className="mt-3 grid gap-2 sm:grid-cols-[1fr_100px_1fr_1fr_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  addItem.mutate({ category_id: c.id, name: String(f.get("name")), price: Number(f.get("price")), description: String(f.get("description") ?? ""), image_url: String(f.get("image") ?? "") });
                  e.currentTarget.reset();
                }}
              >
                <Input name="name" placeholder="Item name" required />
                <Input name="price" type="number" min={0} step="0.01" placeholder="₹" required />
                <Input name="description" placeholder="Description (optional)" />
                <Input name="image" type="url" placeholder="Image URL (optional)" />
                <Button type="submit" variant="secondary">Add item</Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
