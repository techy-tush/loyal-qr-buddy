import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Gift, Instagram, MessageCircle, Star, Store, Ticket } from "lucide-react";
import {
  getCustomerPortal,
  playScratch,
  selfStamp,
  submitFeedback,
} from "@/lib/public.functions";
import { Logo } from "@/components/brand/Logo";
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
      { property: "og:title", content: "My loyalty card | Digital Udyam" },
      {
        property: "og:description",
        content: "Your digital stamp card — collect stamps on every visit and redeem rewards.",
      },
    ],
  }),
  component: CustomerPortal,
});

function CustomerPortal() {
  const { customerToken } = Route.useParams();
  const queryClient = useQueryClient();
  const portalFn = useServerFn(getCustomerPortal);
  const stampFn = useServerFn(selfStamp);
  const scratchFn = useServerFn(playScratch);
  const feedbackFn = useServerFn(submitFeedback);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [scratchResult, setScratchResult] = useState<string | null>(null);
  const [justStamped, setJustStamped] = useState(false);

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

  if (portal.isLoading) {
    return (
      <Page>
        <Skeleton className="h-72 w-full rounded-2xl" />
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

  return (
    <Page>
      <div className="surface overflow-hidden">
        <div className="brand-gradient flex items-center gap-3 px-5 py-5">
          {business.logo_url ? (
            <img
              src={business.logo_url}
              alt={business.name}
              className="size-12 rounded-xl bg-white object-cover"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-xl bg-white text-primary">
              <Store className="size-6" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-extrabold">{business.name}</p>
            <p className="text-xs text-muted-foreground">
              {customer.full_name} · {customer.total_visits} visits
            </p>
          </div>
        </div>

        <div className="p-5">
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
              {business.stamp_mode === "SELF_SCAN" ? (
                <Button
                  className="mt-5 w-full"
                  size="lg"
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
              This business hasn’t set up a stamp card yet. Your visits are still being recorded.
            </p>
          )}
        </div>
      </div>

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
                <p className="mt-1 font-mono text-lg font-extrabold tracking-widest text-primary">
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
            {history.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{r.description}</span>
                <Badge variant="secondary">{r.status.toLowerCase()}</Badge>
              </div>
            ))}
          </div>
        ) : null}
      </Section>

      {offers.length > 0 ? (
        <Section title="Offers for you" icon={Ticket}>
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
        </Section>
      ) : null}

      {campaign && (scratchAvailable || scratchResult) ? (
        <Section title="Scratch & win" icon={Gift}>
          {scratchResult ? (
            <p className="rounded-xl bg-accent/50 p-4 text-center text-sm font-semibold">
              {scratchResult}
            </p>
          ) : (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => scratch.mutate(campaign.id)}
              disabled={scratch.isPending}
            >
              {scratch.isPending ? "Scratching…" : `Play ${campaign.name}`}
            </Button>
          )}
        </Section>
      ) : null}

      <Section title="Rate your visit" icon={Star}>
        {feedbackSent ? (
          <p className="text-sm text-muted-foreground">Thanks — your feedback was sent.</p>
        ) : (
          <>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star`}
                  onClick={() => setRating(n)}
                  className="p-1"
                >
                  <Star
                    className={cn(
                      "size-7",
                      n <= rating ? "fill-primary text-primary" : "text-muted-foreground/40",
                    )}
                  />
                </button>
              ))}
            </div>
            <Textarea
              className="mt-3"
              placeholder="Tell us how it went (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              className="mt-3 w-full"
              disabled={rating === 0 || feedback.isPending}
              onClick={() => feedback.mutate()}
            >
              {feedback.isPending ? "Sending…" : "Send feedback"}
            </Button>
          </>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {business.google_review_url ? (
            <Button asChild size="sm" variant="outline">
              <a href={business.google_review_url} target="_blank" rel="noreferrer">
                <Star className="mr-1.5 size-4" /> Google review
              </a>
            </Button>
          ) : null}
          {business.instagram_url ? (
            <Button asChild size="sm" variant="outline">
              <a href={business.instagram_url} target="_blank" rel="noreferrer">
                <Instagram className="mr-1.5 size-4" /> Instagram
              </a>
            </Button>
          ) : null}
          {business.whatsapp_number ? (
            <Button asChild size="sm" variant="outline">
              <a
                href={`https://wa.me/${business.whatsapp_number.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="mr-1.5 size-4" /> WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      </Section>
    </Page>
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
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="flex justify-center">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );
}
