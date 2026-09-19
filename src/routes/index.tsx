import { createFileRoute, Link } from "@tanstack/react-router";
import {
  QrCode,
  Stamp,
  Users,
  Gift,
  BarChart3,
  UtensilsCrossed,
  Building2,
  Sparkles,
  Star,
  ArrowRight,
  Check,
} from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { LoyaltyCardPreview } from "@/components/site/LoyaltyCardPreview";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import heroImage from "@/assets/hero-qr-counter.jpg";
import { PlanGrid } from "@/components/site/PlanGrid";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digital Udyam | Turn Every Visit Into a Repeat Customer" },
      {
        name: "description",
        content:
          "QR loyalty & customer retention platform for local businesses. Digital stamp cards, rewards, offers, customer CRM and analytics in one simple platform.",
      },
      { property: "og:title", content: "Digital Udyam | Turn Every Visit Into a Repeat Customer" },
      {
        property: "og:description",
        content:
          "QR loyalty, digital stamp cards, rewards and customer CRM for cafes, salons, gyms and local shops.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: QrCode, title: "QR Loyalty", text: "One scan joins a customer to your loyalty program — no app to install." },
  { icon: Stamp, title: "Digital Stamp Cards", text: "Replace paper cards with tamper-proof digital stamps issued by your staff." },
  { icon: Users, title: "Customer CRM", text: "Every visitor becomes a contact with visits, birthdays and reward history." },
  { icon: Gift, title: "Offers & Rewards", text: "Auto-generated reward codes, discounts, BOGO and scratch card campaigns." },
  { icon: BarChart3, title: "Analytics", text: "Track scans, repeat rate, stamp activity and redemptions in real time." },
  { icon: UtensilsCrossed, title: "Digital Menu", text: "A beautiful mobile menu on its own link — updated in seconds." },
  { icon: Building2, title: "Multi-Branch", text: "Separate QR codes, staff and analytics for every outlet you run." },
  { icon: Sparkles, title: "Retention Automation", text: "Birthday, anniversary and win-back campaigns that run themselves." },
];

const steps = [
  { n: "01", title: "Set up your loyalty program", text: "Tell us how many stamps unlock a reward. Takes two minutes." },
  { n: "02", title: "Print your QR code", text: "Place it at your counter, table or bill. Customers scan and join instantly." },
  { n: "03", title: "Stamp every visit", text: "Your staff confirms the visit, the digital card updates securely." },
  { n: "04", title: "Watch repeat visits grow", text: "Rewards, offers and automation bring customers back again." },
];

const faqs = [
  { q: "Do my customers need to download an app?", a: "No. They scan your QR code and get a digital loyalty card in their mobile browser." },
  { q: "Can I use it across multiple outlets?", a: "Yes. Add branches, each with its own QR code, staff and analytics." },
  { q: "How are stamps protected from misuse?", a: "Stamps are validated on our servers with cooldowns, daily limits and staff authorisation, plus a full audit log." },
  { q: "Is there a free trial?", a: "Yes — every business starts with a 3 day free trial. No card needed." },
];

function Landing() {
  return (
    <SiteShell>
      {/* HERO */}
      <section className="brand-gradient border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary shadow-card">
              <Star className="size-3.5" /> QR Loyalty & Customer Retention Platform
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] md:text-6xl">
              Turn Every Visit Into a Repeat Customer
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
              Digital Udyam helps local businesses build customer loyalty, increase repeat visits and
              manage customer relationships with one simple QR-powered platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/signup">
                  Start free trial <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              3 day free trial · No credit card · Cafes, salons, gyms, retail & more
            </p>
          </div>
          <div className="relative">
            <img
              src={heroImage}
              alt="QR loyalty standee on a cafe counter"
              className="w-full rounded-3xl border border-border object-cover shadow-lift"
            />
            <div className="absolute -bottom-6 -left-4 hidden md:block">
              <LoyaltyCardPreview />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading eyebrow="How it works" title="Loyalty that runs itself" />
        <div className="mt-10 grid gap-5 md:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="surface p-6">
              <span className="font-display text-sm font-bold text-primary">{s.n}</span>
              <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <SectionHeading
            eyebrow="Everything included"
            title="One platform for loyalty, customers and growth"
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-background p-6">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CRM + CARD SHOWCASE */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Customer CRM"
              title="Know every customer, not just every sale"
            />
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Visit history, stamps and rewards on one profile",
                "Filter by new, repeat, inactive, VIP or birthday",
                "Feedback and ratings collected after each visit",
                "Win-back campaigns for customers who stopped coming",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-8" asChild>
              <Link to="/features">Explore features</Link>
            </Button>
          </div>
          <div className="flex justify-center gap-6">
            <LoyaltyCardPreview stamps={9} />
            <div className="surface hidden w-44 flex-col gap-3 p-5 sm:flex">
              <p className="text-xs font-semibold text-muted-foreground">This month</p>
              <Metric label="QR scans" value="1,284" />
              <Metric label="Repeat rate" value="62%" />
              <Metric label="Rewards" value="98" />
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <SectionHeading eyebrow="Pricing" title="Simple plans that grow with you" />
          <div className="mt-10">
            <PlanGrid />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-20">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <Accordion type="single" collapsible className="mt-8">
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left text-sm font-semibold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="brand-gradient rounded-3xl border border-border p-10 text-center md:p-16">
          <h2 className="text-2xl font-extrabold md:text-4xl">
            Start turning visits into repeat customers
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
            Set up your loyalty program and print your first QR code today.
          </p>
          <Button size="lg" className="mt-7" asChild>
            <Link to="/signup">Start your free trial</Link>
          </Button>
        </div>
      </section>
    </SiteShell>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      {eyebrow ? (
        <span className="text-xs font-bold uppercase tracking-widest text-primary">{eyebrow}</span>
      ) : null}
      <h2 className="mt-2 text-2xl font-extrabold md:text-4xl">{title}</h2>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-extrabold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
