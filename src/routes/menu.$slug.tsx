import { catalogLabel } from "@/lib/validation";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicMenu } from "@/lib/public.functions";

export const Route = createFileRoute("/menu/$slug")({
  head: () => ({
    meta: [
      { title: "Digital menu | Digital Udyam" },
      { name: "description", content: "Browse the shop's menu, prices and today's availability." },
      { property: "og:title", content: "Digital menu" },
      { property: "og:description", content: "Browse the menu on your phone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getPublicMenu);
  const q = useQuery({ queryKey: ["public-menu", slug], queryFn: () => fn({ data: { slug } }), retry: false });

  if (q.isLoading) return <div className="mx-auto max-w-md p-4"><Skeleton className="h-96 rounded-2xl" /></div>;
  if (q.isError || !q.data)
    return (
      <div className="mx-auto grid min-h-screen max-w-md place-items-center p-6 text-center">
        <div>
          <UtensilsCrossed className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Menu not available</p>
          <p className="mt-1 text-sm text-muted-foreground">{(q.error as Error)?.message ?? "Please ask the staff."}</p>
        </div>
      </div>
    );
  const { business, categories, items } = q.data;
  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-10">
      <header className="bg-primary px-5 pb-8 pt-10 text-primary-foreground">
        <div className="flex items-center gap-3">
          {business.logo_url ? <img src={business.logo_url} alt="" className="size-12 rounded-xl bg-background object-cover" /> : null}
          <div>
            <h1 className="font-display text-2xl font-bold">{business.name}</h1>
            <p className="text-sm opacity-80">{catalogLabel(business.category)}{business.city ? ` · ${business.city}` : ""}</p>
          </div>
        </div>
      </header>
      <nav className="sticky top-0 z-10 -mt-4 flex gap-2 overflow-x-auto bg-background px-4 py-3">
        {categories.map((c) => (
          <a key={c.id} href={`#c-${c.id}`} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">{c.name}</a>
        ))}
      </nav>
      <main className="space-y-6 px-4">
        {categories.map((c) => (
          <section key={c.id} id={`c-${c.id}`}>
            <h2 className="mb-2 text-lg font-bold">{c.name}</h2>
            <ul className="space-y-2">
              {items.filter((i) => i.category_id === c.id).map((i) => (
                <li key={i.id} className={`surface flex gap-3 p-3 ${i.is_available ? "" : "opacity-50"}`}>
                  {i.image_url ? <img src={i.image_url} alt={i.name} loading="lazy" className="size-16 rounded-xl object-cover" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.name}{i.dietary_label ? <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium">{i.dietary_label}</span> : null}</p>
                    {i.description ? <p className="text-xs text-muted-foreground">{i.description}</p> : null}
                    {!i.is_available ? <p className="mt-1 text-xs font-semibold text-destructive">Not available today</p> : null}
                    {i.enquiry_enabled && business.whatsapp_number ? (
                      <a className="mt-1 inline-block text-xs font-semibold text-primary underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${business.whatsapp_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi, I'd like to know more about ${i.name}`)}`}>Enquire on WhatsApp</a>
                    ) : null}
                  </div>
                  {Number(i.price) > 0 ? <span className="font-bold text-primary">₹{Number(i.price)}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {categories.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Coming soon.</p> : null}
      </main>
    </div>
  );
}
