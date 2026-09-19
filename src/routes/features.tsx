import { createFileRoute } from "@tanstack/react-router";
import {
  QrCode,
  Stamp,
  Users,
  Gift,
  BarChart3,
  UtensilsCrossed,
  Building2,
  Sparkles,
  Ticket,
  MessageSquareHeart,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { SiteShell, PageHero } from "@/components/site/SiteShell";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features | Digital Udyam QR Loyalty Platform" },
      {
        name: "description",
        content:
          "QR loyalty, digital stamp cards, rewards, offers, scratch cards, digital menu, customer CRM, analytics and multi-branch management.",
      },
      { property: "og:title", content: "Features | Digital Udyam" },
      {
        property: "og:description",
        content: "Everything a local business needs to increase repeat customers.",
      },
    ],
  }),
  component: FeaturesPage,
});

const groups = [
  {
    icon: QrCode,
    title: "QR Loyalty",
    text: "Business, branch, campaign, menu and loyalty QR codes with secure tokens, scan tracking, PNG/SVG download and print-ready output.",
  },
  {
    icon: Stamp,
    title: "Digital Stamp Cards",
    text: "Server-validated stamps with cooldowns, daily limits, branch validation and a complete audit trail. Staff approval or self-scan mode.",
  },
  {
    icon: Gift,
    title: "Rewards",
    text: "Rewards are created automatically when a card completes, each with a unique code, expiry and one-time redemption.",
  },
  {
    icon: Ticket,
    title: "Offers",
    text: "Percentage, flat, BOGO, free product or custom offers targeted at new, repeat, inactive or VIP customers.",
  },
  {
    icon: Sparkles,
    title: "Scratch Cards",
    text: "Gamified campaigns with server-side probability so prizes can never be manipulated from a phone.",
  },
  {
    icon: Users,
    title: "Customer CRM",
    text: "Profiles with visits, stamps, rewards, feedback, birthdays and anniversaries. Search and filter your entire customer base.",
  },
  {
    icon: UtensilsCrossed,
    title: "Digital Menu",
    text: "Categories, items, prices, photos and availability on a shareable mobile menu link.",
  },
  {
    icon: MessageSquareHeart,
    title: "Feedback",
    text: "Collect ratings and comments after visits, then route happy customers to Google reviews, Instagram or WhatsApp.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    text: "Customer growth, QR scans, repeat rate, stamp activity and redemptions — by day, week, month or branch.",
  },
  {
    icon: Building2,
    title: "Multi-Branch",
    text: "Per-branch QR codes, staff, customers and analytics with a branch selector across the dashboard.",
  },
  {
    icon: Bell,
    title: "Automation",
    text: "Birthday, anniversary, reward-expiry and win-back campaigns with a provider-agnostic notification log.",
  },
  {
    icon: ShieldCheck,
    title: "Security",
    text: "Role-based access, strict tenant isolation, row level security and server-side validation on every sensitive action.",
  },
];

function FeaturesPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Features"
        title="Everything you need to keep customers coming back"
        subtitle="Digital Udyam replaces paper stamp cards, spreadsheets and guesswork with one connected platform."
      />
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.title} className="surface p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                <g.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{g.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{g.text}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
