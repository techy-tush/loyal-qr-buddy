import { SOCIAL_KEYS, catalogLabel, safeHttpsUrl, type SocialLinks } from "@/lib/validation";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { clearCustomerSession, setCustomerSession } from "@/lib/customer-session";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  Gift,
  Instagram,
  MessageCircle,
  Star,
  Store,
  Ticket,
  UserRound,
  Compass,
  MapPin,
  Search,
  Clock3,
  CheckCircle2,
  XCircle,
  LogOut,
  ChevronRight,
  Facebook,
  Phone,
  UtensilsCrossed,
  Sparkles,
  Copy,
  Check,
  Youtube,
  Users,
  Send,
  Twitter,
  Linkedin,
  Globe,
} from "lucide-react";
import {
  getCustomerPortal,
  getCustomerProfile,
  getVisitStatus,
  playScratch,
  requestVisit,
  selfStamp,
  submitFeedback,
  updateCustomerProfile,
  exploreBusinesses,
  getMyShops,
  visitBusiness,
  generateReviewSuggestion,
} from "@/lib/public.functions";
import { registerPushDevice } from "@/lib/push.functions";
import { enablePush, pushClientReady } from "@/lib/push-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/card/$customerToken")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My loyalty card | Digital Udyam" },
      {
        name: "description",
        content: "See your stamps, rewards and offers, and unlock your next free treat.",
      },
      { name: "theme-color", content: "#E8F7EF" },
      { property: "og:title", content: "My loyalty card | Digital Udyam" },
      {
        property: "og:description",
        content: "Your digital stamp card — collect stamps on every visit and redeem rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerPortal,
});

type TabKey = "card" | "rewards" | "offers" | "explore" | "feedback" | "profile";

const TABS: { key: TabKey; label: string; icon: typeof Gift }[] = [
  { key: "card", label: "Visit", icon: Store },
  { key: "rewards", label: "Rewards", icon: Gift },
  { key: "offers", label: "Offers", icon: Ticket },
  { key: "explore", label: "Explore", icon: Compass },
  { key: "feedback", label: "Rate", icon: Star },
  { key: "profile", label: "Profile", icon: UserRound },
];

function CustomerPortal() {
  const { customerToken } = Route.useParams();
  const queryClient = useQueryClient();
  const portalFn = useServerFn(getCustomerPortal);
  const feedbackFn = useServerFn(submitFeedback);
  const registerFn = useServerFn(registerPushDevice);

  const [tab, setTab] = useState<TabKey>("card");
  useEffect(() => {
    setCustomerSession(customerToken);
    setTab("card");
  }, [customerToken]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [alertsOn, setAlertsOn] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setAlertsOn(true);
    }
  }, []);

  const portal = useQuery({
    queryKey: ["portal", customerToken],
    queryFn: () => portalFn({ data: { customerToken } }),
    retry: false,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["portal", customerToken] }),
    [queryClient, customerToken],
  );


  const feedback = useMutation({
    mutationFn: () => feedbackFn({ data: { customerToken, rating, comment } }),
    onSuccess: () => {
      setFeedbackSent(true);
      toast.success("Thanks for your feedback!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alerts = useMutation({
    mutationFn: async () => {
      const res = await enablePush();
      if (res.status !== "registered") return res;
      await registerFn({ data: { customerToken, token: res.token, platform: "WEB" } });
      return res;
    },
    onSuccess: (res) => {
      if (res.status === "registered") {
        setAlertsOn(true);
        toast.success("Alerts on — we'll tell you when a reward or offer lands.");
        return;
      }
      if (res.status === "open-in-new-tab") {
        toast.info("Open this page in your browser (not inside the preview) to turn on alerts.");
        return;
      }
      if (res.status === "denied") {
        toast.error("Alerts are blocked. Allow notifications for this site in your browser settings.");
        return;
      }
      if (res.status === "unsupported") {
        toast.error("This phone or browser can't show alerts.");
        return;
      }
      toast.info("Alerts aren't switched on for this shop yet.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (portal.isLoading) {
    return (
      <Page>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </Page>
    );
  }

  if (portal.isError || !portal.data?.business) {
    return (
      <Page>
        <div className="surface p-8 text-center">
          <h1 className="font-display text-xl font-bold">Card not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Scan the QR code at the counter again to open your loyalty card.
          </p>
        </div>
      </Page>
    );
  }

  const { customer, business, card, rewards, offers, campaign, scratchAvailable, addons } = portal.data;
  const program = card?.program as
    | { name: string; stamps_required: number; reward_description: string }
    | null
    | undefined;
  const available = rewards.filter((r) => r.status === "AVAILABLE");
  const history = rewards.filter((r) => r.status !== "AVAILABLE");
  const remaining = program && card ? Math.max(program.stamps_required - card.stamps, 0) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky mobile header */}
      <header className="sticky top-0 z-20 border-b border-border bg-accent/70 backdrop-blur supports-[backdrop-filter]:bg-accent/60">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 py-3">
          {business.logo_url ? (
            <img
              src={business.logo_url}
              alt={business.name}
              className="size-11 shrink-0 rounded-xl bg-white object-cover"
            />
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
              <Store className="size-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-extrabold leading-tight">
              {business.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {customer.full_name} · {customer.total_visits} visits
            </p>
          </div>
          {pushClientReady() ? (
            <Button
              size="icon"
              variant={alertsOn ? "default" : "outline"}
              aria-label={alertsOn ? "Alerts are on" : "Turn on alerts"}
              className="shrink-0 rounded-full"
              disabled={alerts.isPending || alertsOn}
              onClick={() => alerts.mutate()}
            >
              {alertsOn ? <BellRing className="size-4" /> : <Bell className="size-4" />}
            </Button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-md space-y-4 px-4 pb-28 pt-4">
        {tab === "card" ? (
          <>
            {/* 1. Stamp card */}
            <div className="surface p-5">
              {card && program ? (
                <>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{business.name}</p>
                  <p className="mt-1 text-sm font-semibold">Reward: {program.reward_description}</p>
                  <StampCircles done={card.stamps} total={program.stamps_required} />
                  <p className="mt-3 text-center text-sm font-bold">
                    {Math.min(card.stamps, program.stamps_required)}/{program.stamps_required} Visits Completed
                  </p>
                  <p className="mt-1 text-center text-xs font-semibold text-primary">
                    {remaining === 0
                      ? "Your reward is ready!"
                      : `${remaining} more ${remaining === 1 ? "visit" : "visits"} to unlock your reward`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Your visits are being recorded.</p>
              )}
              <VisitRequestPanel customerToken={customerToken} onDecided={invalidate} />
            </div>

            {/* 2. Google review actions */}
            {addons.reviewWriter ? (
              <div className="surface p-5 pt-0">
                <ReviewWriter customerToken={customerToken} reviewUrl={business.google_review_url} category={business.category ?? ""} />
              </div>
            ) : business.google_review_url ? (
              <Button asChild size="lg" variant="outline" className="w-full">
                <a href={business.google_review_url} target="_blank" rel="noopener noreferrer"><Star className="mr-2 size-4" /> Write a Google review</a>
              </Button>
            ) : null}

            {/* 3–5. Social links, menu/catalog, location & contact */}
            <ShopProfile business={business} offers={offers} onOffers={() => setTab("offers")} menu={addons.menu ? { href: `/menu/${business.slug}`, label: catalogLabel(business.category) } : null} />

            <MyShops customerToken={customerToken} currentBusinessId={business.id} onExplore={() => setTab("explore")} />

            {pushClientReady() && !alertsOn ? (
              <button
                type="button"
                onClick={() => alerts.mutate()}
                disabled={alerts.isPending}
                className="surface flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                  <Bell className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Get alerts</span>
                  <span className="block text-xs text-muted-foreground">
                    Know the moment a reward or new offer is ready for you.
                  </span>
                </span>
              </button>
            ) : null}
          </>
        ) : null}

        {tab === "rewards" ? (
          <Section title="My rewards" icon={Gift}>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rewards yet — keep collecting stamps to unlock your first one.
              </p>
            ) : (
              <div className="space-y-2">
                {available.map((r) => (
                  <div key={r.id} className="rounded-xl border border-primary/40 bg-accent/40 p-3">
                    <p className="text-sm font-semibold">{r.description}</p>
                    <p className="mt-1 font-mono text-xl font-extrabold tracking-widest text-primary">
                      {r.code}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.expires_at
                        ? `Expires ${new Date(r.expires_at).toLocaleDateString()}`
                        : "No expiry"}{" "}
                      · show this code at the counter
                    </p>
                  </div>
                ))}
              </div>
            )}
            {history.length > 0 ? (
              <div className="mt-4 space-y-1.5">
                {history.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{r.description}</span>
                    <Badge variant="secondary">{r.status.toLowerCase()}</Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </Section>
        ) : null}

        {tab === "offers" ? (
          <Section title="Offers for you" icon={Ticket}>
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No offers running right now. Turn on alerts and we’ll tell you when one starts.
              </p>
            ) : (
              <div className="space-y-2">
                {offers.map((o) => (
                  <div key={o.id} className="rounded-xl border border-border p-3">
                    <p className="text-sm font-semibold">{o.title}</p>
                    {o.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{o.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Section>
        ) : null}

        {tab === "feedback" ? (
          <Section title="Rate your visit" icon={Star}>
            {feedbackSent ? (
              <p className="text-sm text-muted-foreground">Thanks — your feedback was sent.</p>
            ) : (
              <>
                <div className="flex justify-between gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} star`}
                      onClick={() => setRating(n)}
                      className="p-2"
                    >
                      <Star
                        className={cn(
                          "size-8",
                          n <= rating ? "fill-primary text-primary" : "text-muted-foreground/40",
                        )}
                      />
                    </button>
                  ))}
                </div>
                <Textarea
                  className="mt-3"
                  rows={4}
                  placeholder="Tell us how it went (optional)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button
                  className="mt-3 h-12 w-full"
                  disabled={rating === 0 || feedback.isPending}
                  onClick={() => feedback.mutate()}
                >
                  {feedback.isPending ? "Sending…" : "Send feedback"}
                </Button>
              </>
            )}
            {addons.reviewWriter ? (
              <ReviewWriter customerToken={customerToken} reviewUrl={business.google_review_url} category={business.category ?? ""} />
            ) : null}
            <div className="mt-4 grid gap-2">
              {addons.menu ? (
                <Button asChild variant="outline" className="h-11 justify-start">
                  <a href={`/menu/${business.slug}`}>
                    <UtensilsCrossed className="mr-2 size-4" /> View {catalogLabel(business.category).toLowerCase()}
                  </a>
                </Button>
              ) : null}
              {business.google_review_url ? (
                <Button asChild variant="outline" className="h-11 justify-start">
                  <a href={business.google_review_url} target="_blank" rel="noreferrer">
                    <Star className="mr-2 size-4" /> Leave a Google review
                  </a>
                </Button>
              ) : null}
              {business.instagram_url ? (
                <Button asChild variant="outline" className="h-11 justify-start">
                  <a href={business.instagram_url} target="_blank" rel="noreferrer">
                    <Instagram className="mr-2 size-4" /> Follow on Instagram
                  </a>
                </Button>
              ) : null}
              {business.whatsapp_number ? (
                <Button asChild variant="outline" className="h-11 justify-start">
                  <a
                    href={`https://wa.me/${business.whatsapp_number.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="mr-2 size-4" /> Chat on WhatsApp
                  </a>
                </Button>
              ) : null}
            </div>
          </Section>
        ) : null}

        {tab === "explore" ? <ExplorePanel customerToken={customerToken} /> : null}

        {tab === "profile" ? <ProfilePanel customerToken={customerToken} phone={customer.phone} /> : null}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-md">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            const count = key === "rewards" ? available.length : 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "fill-primary/15")} />
                {label}
                {count > 0 ? (
                  <span className="absolute right-[22%] top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Gift;
  children: React.ReactNode;
}) {
  return (
    <div className="surface p-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" /> {title}
      </p>
      {children}
    </div>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-4">{children}</div>
    </div>
  );
}

function VisitRequestPanel({ customerToken, onDecided }: { customerToken: string; onDecided: () => void }) {
  const statusFn = useServerFn(getVisitStatus);
  const requestFn = useServerFn(requestVisit);
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["visit-status", customerToken],
    queryFn: () => statusFn({ data: { customerToken } }),
    refetchInterval: (q) => (q.state.data?.status === "PENDING" ? 5000 : false),
  });
  const last = status.data;
  const [seenDecision, setSeenDecision] = useState<string | null>(null);
  useEffect(() => {
    if (last?.id && last.status !== "PENDING" && last.id !== seenDecision) {
      setSeenDecision(last.id);
      onDecided();
    }
  }, [last, seenDecision, onDecided]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!last?.next_visit_at) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [last?.next_visit_at]);
  const send = useMutation({
    mutationFn: () => requestFn({ data: { customerToken } }),
    onSuccess: () => {
      toast.success("Request sent — the shop owner will approve it.");
      queryClient.invalidateQueries({ queryKey: ["visit-status", customerToken] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const recent = last?.created_at && Date.now() - new Date(last.decided_at ?? last.created_at).getTime() < 6 * 3600000;
  const waitMs = last?.next_visit_at ? new Date(last.next_visit_at).getTime() - now : 0;

  if (last?.status === "PENDING")
    return (
      <p className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-accent/60 p-3 text-sm font-semibold">
        <Clock3 className="size-4 text-primary" /> Waiting for owner approval…
      </p>
    );
  return (
    <div className="mt-5 space-y-3">
      {recent && last?.status === "APPROVED" ? (
        <p className="flex items-center justify-center gap-2 rounded-xl bg-accent/60 p-3 text-sm font-semibold text-primary">
          <CheckCircle2 className="size-4" /> Your last visit was approved
        </p>
      ) : null}
      {recent && last?.status === "REJECTED" ? (
        <p className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          <XCircle className="size-4" /> Your last request was rejected
        </p>
      ) : null}
      {waitMs > 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-semibold">
            <Clock3 className="size-4 text-primary" /> Next visit not available yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your next visit will be available in {Math.floor(waitMs / 3600000)} hours and{" "}
            {Math.ceil((waitMs % 3600000) / 60000)} minutes. Visits count once every 24 hours.
          </p>
        </div>
      ) : (
        <>
          <p className="text-center text-sm font-semibold text-primary">Visit available — apply now</p>
          <Button className="h-12 w-full text-base" onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending ? "Sending…" : "Apply now — I'm here"}
          </Button>
        </>
      )}
    </div>
  );
}

function ProfilePanel({ customerToken, phone }: { customerToken: string; phone: string }) {
  const getFn = useServerFn(getCustomerProfile);
  const saveFn = useServerFn(updateCustomerProfile);
  const profile = useQuery({
    queryKey: ["customer-profile", customerToken],
    queryFn: () => getFn({ data: { customerToken } }),
  });
  const [form, setForm] = useState({ full_name: "", email: "", dob: "", anniversary: "", marketing_consent: false });
  useEffect(() => {
    if (!profile.data) return;
    setForm({
      full_name: profile.data.full_name,
      email: profile.data.email ?? "",
      dob: profile.data.dob ?? "",
      anniversary: profile.data.anniversary ?? "",
      marketing_consent: profile.data.marketing_consent,
    });
  }, [profile.data]);
  const save = useMutation({
    mutationFn: () => saveFn({ data: { customerToken, ...form } }),
    onSuccess: () => toast.success("Profile saved."),
    onError: (e: Error) => toast.error(e.message),
  });
  if (profile.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  return (
    <Section title="My profile" icon={UserRound}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="grid gap-1.5"><Label htmlFor="p-name">Name</Label><Input id="p-name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label>Mobile</Label><Input value={phone} disabled /></div>
        <div className="grid gap-1.5"><Label htmlFor="p-email">Email</Label><Input id="p-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5"><Label htmlFor="p-dob">Birthday</Label><Input id="p-dob" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="p-ann">Anniversary</Label><Input id="p-ann" type="date" value={form.anniversary} onChange={(e) => setForm({ ...form, anniversary: e.target.value })} /></div>
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <Checkbox checked={form.marketing_consent} onCheckedChange={(v) => setForm({ ...form, marketing_consent: Boolean(v) })} />
          Send me offers and reward reminders.
        </label>
        <Button type="submit" className="h-11" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save profile"}</Button>
      </form>
      <LogoutButton />
    </Section>
  );
}

function ExplorePanel({ customerToken }: { customerToken: string }) {
  const exploreFn = useServerFn(exploreBusinesses);
  const visitFn = useServerFn(visitBusiness);
  const navigate = useNavigate();
  const visit = useMutation({
    mutationFn: (businessId: string) => visitFn({ data: { customerToken, businessId } }),
    onSuccess: (res) => {
      toast.success("Shop added to your account.");
      navigate({ to: "/card/$customerToken", params: { customerToken: res.customerToken } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [debounced, setDebounced] = useState({ q: "", city: "" });
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ q, city }), 300);
    return () => clearTimeout(t);
  }, [q, city]);
  const list = useQuery({
    queryKey: ["explore", debounced],
    queryFn: () => exploreFn({ data: debounced }),
  });
  const rows = list.data?.businesses ?? [];
  return (
    <div className="space-y-3">
      <div className="surface space-y-3 p-4">
        <p className="font-display text-lg font-bold">Explore nearby</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search cafe, salon, gym…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="City, area or pincode" value={city} list="explore-cities" onChange={(e) => setCity(e.target.value)} />
          <datalist id="explore-cities">{(list.data?.cities ?? []).map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        {(list.data?.cities ?? []).length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(list.data?.cities ?? []).slice(0, 12).map((c) => (
              <button key={c} type="button" onClick={() => setCity(city === c ? "" : c)} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", city === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{c}</button>
            ))}
          </div>
        ) : null}
      </div>
      {list.isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : rows.length === 0 ? (
        <p className="surface p-6 text-center text-sm text-muted-foreground">No businesses found here yet. Try another area.</p>
      ) : (
        rows.map((b) => (
          <div key={b.id} className="surface flex items-center gap-3 p-3">
            {b.logo_url ? (
              <img src={b.logo_url} alt={b.name} className="size-12 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Store className="size-5" /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{b.name}</p>
              <p className="truncate text-xs text-muted-foreground">{[b.category, b.city].filter(Boolean).join(" · ")}</p>
              {b.address ? <p className="truncate text-xs text-muted-foreground">{b.address}</p> : null}
            </div>
            <Button size="sm" disabled={visit.isPending} onClick={() => visit.mutate(b.id)}>Visit</Button>
            {b.address || b.city ? (
              <Button asChild size="sm" variant="outline">
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.name, b.address, b.city].filter(Boolean).join(", "))}`} target="_blank" rel="noreferrer">Map</a>
              </Button>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

function LogoutButton() {
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      className="mt-4 h-11 w-full text-destructive"
      onClick={() => {
        clearCustomerSession();
        toast.success("Logged out.");
        navigate({ to: "/" });
      }}
    >
      <LogOut className="size-4" /> Log out
    </Button>
  );
}

function MyShops({ customerToken, currentBusinessId, onExplore }: { customerToken: string; currentBusinessId: string; onExplore: () => void }) {
  const shopsFn = useServerFn(getMyShops);
  const shops = useQuery({ queryKey: ["my-shops", customerToken], queryFn: () => shopsFn({ data: { customerToken } }) });
  const list = shops.data ?? [];
  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-base font-bold">My shops ({list.length})</p>
        <button type="button" onClick={onExplore} className="text-xs font-semibold text-primary">+ Visit more</button>
      </div>
      {shops.isLoading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : (
        <div className="space-y-2">
          {list.map((s) => {
            const current = s.businessId === currentBusinessId;
            return (
              <Link
                key={s.businessId}
                to="/card/$customerToken"
                params={{ customerToken: s.token }}
                className={cn("flex items-center gap-3 rounded-xl border p-3", current ? "border-primary bg-accent/60" : "border-border bg-card")}
              >
                {s.logo_url ? (
                  <img src={s.logo_url} alt={s.name} className="size-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Store className="size-4" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.visits} visits{s.offers ? ` · ${s.offers} offers` : ""}{s.rewards ? ` · ${s.rewards} rewards` : ""}
                  </p>
                </div>
                {current ? <Badge>Here</Badge> : <ChevronRight className="size-4 text-muted-foreground" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StampCircles({ done, total }: { done: number; total: number }) {
  const cols = total <= 5 ? "grid-cols-5" : "grid-cols-5 sm:grid-cols-10";
  return (
    <div className={`mt-4 grid ${cols} gap-2.5`}>
      {Array.from({ length: total }).map((_, i) => {
        const filled = i < done;
        return (
          <span
            key={i}
            aria-label={filled ? `Visit ${i + 1} done` : `Visit ${i + 1} remaining`}
            className={`mx-auto grid aspect-square w-full max-w-12 place-items-center rounded-full border-2 text-xs font-bold ${filled ? "border-primary bg-primary text-primary-foreground" : "border-dashed border-border text-muted-foreground"}`}
          >
            {filled ? <Check className="size-4" /> : i + 1}
          </span>
        );
      })}
    </div>
  );
}

const SOCIAL_ICON: Record<string, typeof MapPin> = {
  youtube: Youtube, google_maps: MapPin, google_reviews: Star, facebook: Facebook, instagram: Instagram,
  whatsapp: MessageCircle, whatsapp_group: Users, whatsapp_community: Users, telegram: Send, x: Twitter, linkedin: Linkedin,
};

function ShopProfile({
  business,
  offers,
  onOffers,
  menu,
}: {
  business: { name: string; category?: string | null; address?: string | null; city?: string | null; phone?: string | null; google_review_url: string | null; instagram_url: string | null; whatsapp_number: string | null; facebook_url?: string | null; google_maps_url?: string | null; social_links?: unknown };
  offers: { id: string; title: string; description: string | null }[];
  onOffers: () => void;
  menu: { href: string; label: string } | null;
}) {
  const social = (business.social_links ?? {}) as SocialLinks;
  const links: { href: string; label: string; icon: typeof MapPin }[] = [];
  const seen = new Set<string>();
  for (const [key, label] of SOCIAL_KEYS) {
    const v = social[key];
    const url = v?.enabled && v.url ? safeHttpsUrl(v.url) : null;
    if (url) { links.push({ href: url, label, icon: SOCIAL_ICON[key] ?? Globe }); seen.add(key); }
  }
  // Older single fields, if not already in the new list.
  if (!seen.has("instagram") && business.instagram_url) links.push({ href: business.instagram_url, label: "Instagram", icon: Instagram });
  if (!seen.has("facebook") && business.facebook_url) links.push({ href: business.facebook_url, label: "Facebook", icon: Facebook });
  if (!seen.has("whatsapp") && business.whatsapp_number) links.push({ href: `https://wa.me/${business.whatsapp_number.replace(/[^0-9]/g, "")}`, label: "WhatsApp", icon: MessageCircle });
  const mapsUrl =
    (seen.has("google_maps") ? null : business.google_maps_url) ||
    (!seen.has("google_maps") && (business.address || business.city)
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${business.address ?? ""} ${business.city ?? ""}`)}`
      : null);
  return (
    <>
      {links.length ? (
        <div className="surface p-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Follow &amp; connect</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center text-xs font-semibold transition hover:bg-accent">
                <span className="grid size-10 place-items-center rounded-full bg-accent text-primary"><l.icon className="size-5" /></span>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
      {menu ? (
        <Button asChild size="lg" className="w-full">
          <a href={menu.href}><UtensilsCrossed className="mr-2 size-4" /> View {menu.label}</a>
        </Button>
      ) : null}
      <div className="surface p-5">
        <p className="text-xs font-semibold uppercase text-muted-foreground">About the shop</p>
        <p className="mt-1 font-display text-lg font-bold">{business.name}</p>
        {business.category || business.address || business.city ? (
          <p className="text-xs text-muted-foreground">{[business.category, business.address, business.city].filter(Boolean).join(" · ")}</p>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {mapsUrl ? <Button asChild variant="outline" size="sm"><a href={mapsUrl} target="_blank" rel="noopener noreferrer"><MapPin className="mr-1.5 size-4" /> Location</a></Button> : null}
          {business.phone ? <Button asChild variant="outline" size="sm"><a href={`tel:${business.phone}`}><Phone className="mr-1.5 size-4" /> Call</a></Button> : null}
        </div>
        {offers.length ? (
          <button type="button" onClick={onOffers} className="mt-4 w-full rounded-xl bg-accent p-3 text-left">
            <p className="text-sm font-semibold">{offers.length} offer{offers.length > 1 ? "s" : ""} running</p>
            <p className="truncate text-xs text-muted-foreground">{offers.map((o) => o.title).join(" · ")}</p>
          </button>
        ) : null}
      </div>
    </>
  );
}

const TAGS_BY_KIND: [RegExp, string[]][] = [
  [/restaurant|cafe|café|coffee|bakery|food|dhaba|sweet|pizza/i, ["Tasty food", "Friendly staff", "Quick service", "Clean place", "Good value", "Nice ambience"]],
  [/salon|beauty|spa|parlour|parlor|barber/i, ["Great haircut", "Skilled stylist", "Polite staff", "Hygienic", "On-time appointment", "Relaxing"]],
  [/car|auto|wash|garage|detail/i, ["Spotless cleaning", "Quick turnaround", "Careful with vehicle", "Good detailing", "Helpful staff", "Fair price"]],
  [/retail|store|shop|mart|boutique|furniture|electronics/i, ["Good selection", "Helpful staff", "Easy shopping", "Fair prices", "Quality products"]],
  [/clinic|health|hospital|dental|wellness|gym|fitness|physio/i, ["Easy appointment", "Clean facility", "Clear communication", "Courteous staff", "Short wait"]],
  [/school|coaching|tuition|academy|education|class/i, ["Good teaching", "Supportive staff", "Good environment", "Well organised"]],
  [/hotel|resort|stay|hospitality|guest/i, ["Clean rooms", "Warm hospitality", "Good facilities", "Helpful staff", "Comfortable stay"]],
];
function reviewTags(category: string) {
  return TAGS_BY_KIND.find(([re]) => re.test(category))?.[1] ?? ["Friendly staff", "Good service", "Clean place", "Good value", "Would recommend"];
}


function ReviewWriter({ customerToken, reviewUrl, category }: { customerToken: string; reviewUrl: string | null; category: string }) {
  const gen = useServerFn(generateReviewSuggestion);
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [language, setLanguage] = useState<"English" | "Hindi" | "Hinglish">("English");
  const [drafts, setDrafts] = useState<string[]>([]);
  const [text, setText] = useState("");
  const TAGS = reviewTags(category);
  const write = useMutation({
    mutationFn: () => gen({ data: { customerToken, rating, tags, language, experience } }),
    onSuccess: (r) => { setDrafts(r.drafts ?? [r.text]); setText(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-5 rounded-2xl border border-border bg-accent/30 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> Write a Google review with AI</p>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} stars`} onClick={() => setRating(n)}>
            <Star className={`size-6 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {TAGS.map((t) => (
          <button key={t} type="button"
            onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
            className={`rounded-full border px-3 py-1 text-xs ${tags.includes(t) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
            {t}
          </button>
        ))}
      </div>
      <Textarea className="mt-3" rows={2} maxLength={500} placeholder="Your experience in a few words (optional)" value={experience} onChange={(e) => setExperience(e.target.value)} />
      <div className="mt-3 flex gap-2">
        {(["English", "Hindi", "Hinglish"] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLanguage(l)}
            className={`rounded-lg border px-2.5 py-1 text-xs ${language === l ? "border-primary text-primary" : "border-border"}`}>{l}</button>
        ))}
      </div>
      <Button className="mt-3 w-full" variant="secondary" disabled={write.isPending} onClick={() => write.mutate()}>
        {write.isPending ? "Writing…" : drafts.length ? "More suggestions" : "Suggest reviews"}
      </Button>
      {drafts.length && !text ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Pick one to edit:</p>
          {drafts.map((d, i) => (
            <button key={i} type="button" onClick={() => setText(d)} className="w-full rounded-xl border border-border bg-background p-3 text-left text-sm hover:border-primary">{d}</button>
          ))}
        </div>
      ) : null}
      {text ? (
        <>
          <Textarea className="mt-3" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" className="mt-1 text-xs text-primary underline" onClick={() => setText("")}>Back to drafts</button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied — paste it on Google"); }}>
              <Copy className="mr-1.5 size-4" /> Copy
            </Button>
            {reviewUrl ? (
              <Button asChild onClick={() => navigator.clipboard.writeText(text)}>
                <a href={reviewUrl} target="_blank" rel="noopener noreferrer">Post on Google</a>
              </Button>
            ) : <Button disabled>No Google link</Button>}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">You post it yourself. Nothing is published automatically.</p>
        </>
      ) : null}
    </div>
  );
}
