import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, PageHero } from "@/components/site/SiteShell";
import { LoyaltyCardPreview } from "@/components/site/LoyaltyCardPreview";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works | Digital Udyam" },
      {
        name: "description",
        content:
          "Set up a loyalty program, print your QR code, stamp every visit and watch repeat customers grow with Digital Udyam.",
      },
      { property: "og:title", content: "How Digital Udyam Works" },
      {
        property: "og:description",
        content: "From QR scan to repeat visit in four simple steps.",
      },
    ],
  }),
  component: HowItWorks,
});

const businessSteps = [
  { title: "Create your business", text: "Sign up, add your business details and your first branch." },
  { title: "Design your loyalty program", text: "Example: collect 10 stamps and get a FREE Coffee." },
  { title: "Print your QR code", text: "Download a print-ready QR for your counter, table or bill." },
  { title: "Stamp visits", text: "Staff confirms each visit from the dashboard or staff console." },
  { title: "Grow retention", text: "Offers, scratch cards and automation bring customers back." },
];

const customerSteps = [
  { title: "Scan the QR", text: "No app download. The loyalty page opens in the mobile browser." },
  { title: "Join in seconds", text: "Name and phone number is all it takes." },
  { title: "Collect stamps", text: "Every visit updates the digital card instantly." },
  { title: "Unlock rewards", text: "A unique reward code appears when the card completes." },
];

function HowItWorks() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="How it works"
        title="Simple for you. Effortless for your customers."
        subtitle="Two flows, one platform — the business side and the customer side stay perfectly in sync."
      />
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-bold">For your business</h2>
          <ol className="mt-6 space-y-4">
            {businessSteps.map((s, i) => (
              <li key={s.title} className="surface flex gap-4 p-5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="text-xl font-bold">For your customers</h2>
          <ol className="mt-6 space-y-4">
            {customerSteps.map((s, i) => (
              <li key={s.title} className="surface flex gap-4 p-5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex justify-center">
            <LoyaltyCardPreview stamps={7} />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16 text-center">
        <Button size="lg" asChild>
          <Link to="/signup">Start your free trial</Link>
        </Button>
      </section>
    </SiteShell>
  );
}
