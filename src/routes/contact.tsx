import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, PageHero } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContact } from "@/lib/public.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact | Digital Udyam" },
      {
        name: "description",
        content:
          "Talk to the Digital Udyam team about QR loyalty, onboarding your outlets or enterprise and franchise requirements.",
      },
      { property: "og:title", content: "Contact Digital Udyam" },
      { property: "og:description", content: "Questions about QR loyalty? We're happy to help." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const send = useServerFn(submitContact);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const mutation = useMutation({
    mutationFn: () => send({ data: form }),
    onSuccess: () => {
      toast.success("Thanks! We'll get back to you shortly.");
      setForm({ name: "", email: "", message: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Contact"
        title="Let's talk about your customers"
        subtitle="Tell us about your business and we'll help you set up loyalty the right way."
      />
      <section className="mx-auto grid max-w-5xl gap-10 px-4 py-16 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <InfoRow icon={Mail} label="Email" value="hello@digitaludyam.app" />
          <InfoRow icon={Phone} label="Phone" value="+91 00000 00000" />
          <InfoRow icon={MessageSquare} label="Support hours" value="Mon–Sat, 10am – 7pm IST" />
          <p className="text-xs text-muted-foreground">
            These contact details are placeholders — send us your real email, phone and hours and
            we'll put them in.
          </p>
        </div>
        <form
          className="surface space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">How can we help?</Label>
            <Textarea
              id="message"
              rows={5}
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Sending…" : "Send message"}
          </Button>
        </form>
      </section>
    </SiteShell>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="surface flex items-center gap-3 p-4">
      <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
