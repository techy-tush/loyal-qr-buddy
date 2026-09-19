import { createFileRoute } from "@tanstack/react-router";
import { SiteShell, PageHero } from "@/components/site/SiteShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ | Digital Udyam" },
      {
        name: "description",
        content:
          "Answers about QR loyalty, digital stamp cards, rewards, staff access, multi-branch support, pricing and data security on Digital Udyam.",
      },
      { property: "og:title", content: "Frequently asked questions | Digital Udyam" },
      { property: "og:description", content: "Everything about QR loyalty on Digital Udyam." },
    ],
  }),
  component: FaqPage,
});

const faqs = [
  { q: "Do customers need an app?", a: "No. Customers scan your QR code and their loyalty card opens in the mobile browser. They can bookmark or add it to their home screen." },
  { q: "How do I stop staff or customers from adding fake stamps?", a: "Every stamp is validated on our servers with a cooldown, a daily limit per customer, branch validation and staff authorisation. Each stamp is written to an audit log." },
  { q: "Can I run more than one outlet?", a: "Yes. Add branches on Growth and above. Each branch gets its own QR code, staff and analytics, and you can switch branches from the dashboard header." },
  { q: "What happens when a card is complete?", a: "A reward is created automatically with a unique code and an expiry date. Staff enters the code to redeem it, and it can only be redeemed once." },
  { q: "Can I collect customer feedback?", a: "Yes. Customers can rate their visit and leave a comment, and you can link your Google review page, Instagram and WhatsApp." },
  { q: "Is my customer data isolated from other businesses?", a: "Yes. Every record is tied to your business and protected by row level security, so no other business can ever read or change your data." },
  { q: "How long is the free trial?", a: "Three days, with no credit card. You can upgrade or cancel at any time from the Subscription page." },
  { q: "Which payment providers are supported?", a: "The platform is built with a payment abstraction for Razorpay and Stripe. Card details are never stored by Digital Udyam." },
];

function FaqPage() {
  return (
    <SiteShell>
      <PageHero eyebrow="FAQ" title="Frequently asked questions" />
      <section className="mx-auto max-w-3xl px-4 py-16">
        <Accordion type="single" collapsible>
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left text-sm font-semibold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </SiteShell>
  );
}
