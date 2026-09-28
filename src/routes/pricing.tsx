import { createFileRoute } from "@tanstack/react-router";
import { SiteShell, PageHero } from "@/components/site/SiteShell";
import { PlanGrid } from "@/components/site/PlanGrid";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | Digital Udyam QR Loyalty Platform" },
      {
        name: "description",
        content:
          "Basic (₹699/year) and Premium (₹999/year) plans for QR loyalty, rewards and customer CRM. Every business starts with a 3 day free trial.",
      },
      { property: "og:title", content: "Pricing | Digital Udyam" },
      { property: "og:description", content: "Plans that grow with your business. 3 day free trial." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Pricing"
        title="Plans that grow with your business"
        subtitle="Every plan starts with a 3 day free trial. No credit card required."
      />
      <section className="mx-auto max-w-6xl px-4 py-16">
        <PlanGrid />
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Prices in INR, billed yearly. Limited-time launch pricing.
        </p>
      </section>
    </SiteShell>
  );
}
