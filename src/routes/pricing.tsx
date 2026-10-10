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
          "₹699 for 6 months or ₹999 for 12 months, plus multi-branch plans for QR loyalty, rewards and customer CRM.",
      },
      { property: "og:title", content: "Pricing | Digital Udyam" },
      { property: "og:description", content: "₹699 for 6 months or ₹999 for 12 months." },
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
        subtitle="Pay by UPI. Your plan starts as soon as the payment is verified."
      />
      <section className="mx-auto max-w-6xl px-4 py-16">
        <PlanGrid />
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Prices in INR. Optional add-ons: AI Google Review Writer ₹189/year, Digital Menu ₹149/year.
        </p>
      </section>
    </SiteShell>
  );
}
