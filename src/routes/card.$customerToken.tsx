import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import {
  getCustomerPortal,
  playScratch,
  selfStamp,
  submitFeedback,
} from "@/lib/public.functions";
import { registerPushDevice } from "@/lib/push.functions";
import { enablePush, pushClientReady } from "@/lib/push-client";
import { StampGrid } from "@/components/loyalty/StampGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type TabKey = "card" | "rewards" | "offers" | "feedback";

const TABS: { key: TabKey; label: string; icon: typeof Gift }[] = [
  { key: "card", label: "Card", icon: Store },
  { key: "rewards", label: "Rewards", icon: Gift },
  { key: "offers", label: "Offers", icon: Ticket },
  { key: "feedback", label: "Rate", icon: Star },
];

function CustomerPortal() {
  const { customerToken } = Route.useParams();
  const queryClient = useQueryClient();
  const portalFn = useServerFn(getCustomerPortal);
  const stampFn = useServerFn(selfStamp);
  const scratchFn = useServerFn(playScratch);
  const feedbackFn = useServerFn(submitFeedback);
  const registerFn = useServerFn(registerPushDevice);

  const [tab, setTab] = useState<TabKey>("card");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [scratchResult, setScratchResult] = useState<string | null>(null);
  const [justStamped, setJustStamped] = useState(false);
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portal", customerToken] });

  const stamp = useMutation({
    mutationFn: () => stampFn({ data: { customerToken } }),
    onSuccess: (res) => {
      setJustStamped(true);
      toast.success(
        res.rewardUnlocked
          ? `Reward unlocked! Show code ${res.rewardCode} at the counter.`
          : "Stamp added. Enjoy your visit!",
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scratch = useMutation({
    mutationFn: (campaignId: string) => scratchFn({ data: { customerToken, campaignId } }),
    onSuccess: (res) => {
      setScratchResult(res.isWin ? `You won ${res.label}!` : res.label);
      if (res.isWin) toast.success(`You won ${res.label}!`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const { customer, business, card, rewards, offers, campaign, scratchAvailable } = portal.data;
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
            <div className="surface p-5">
              {card && program ? (
                <>
                  <p className="text-sm font-semibold">{program.name}</p>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Reward: {program.reward_description}
                  </p>
                  <StampGrid
                    stamps={card.stamps}
                    required={program.stamps_required}
                    animateLast={justStamped}
                  />
                  <p className="mt-3 text-center text-sm font-semibold text-primary">
                    {remaining === 0
                      ? "Your reward is ready!"
                      : `${remaining} more ${remaining === 1 ? "visit" : "visits"} to unlock your reward`}
                  </p>
                  {business.stamp_mode === "SELF_SCAN" ? (
                    <Button
                      className="mt-5 h-12 w-full text-base"
                      onClick={() => stamp.mutate()}
                      disabled={stamp.isPending}
                    >
                      {stamp.isPending ? "Adding stamp…" : "Add today's stamp"}
                    </Button>
                  ) : (
                    <p className="mt-5 rounded-xl bg-accent/50 p-3 text-center text-xs text-muted-foreground">
                      Show this card at the counter — staff will add your stamp.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This business hasn’t set up a stamp card yet. Your visits are still being
                  recorded.
                </p>
              )}
            </div>

            {campaign && (scratchAvailable || scratchResult) ? (
              <Section title="Scratch & win" icon={Gift}>
                {scratchResult ? (
                  <p className="rounded-xl bg-accent/50 p-4 text-center text-sm font-semibold">
                    {scratchResult}
                  </p>
                ) : (
                  <Button
                    className="h-12 w-full"
                    variant="outline"
                    onClick={() => scratch.mutate(campaign.id)}
                    disabled={scratch.isPending}
                  >
                    {scratch.isPending ? "Scratching…" : `Play ${campaign.name}`}
                  </Button>
                )}
              </Section>
            ) : null}

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
            <div className="mt-4 grid gap-2">
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
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
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
