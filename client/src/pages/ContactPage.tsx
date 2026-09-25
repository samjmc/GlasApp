import { useState } from "react";
import { Link } from "wouter";
import { Mail, Shield, Bug, HelpCircle, Send, AlertTriangle, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const QUICK_CONTACTS = [
  { icon: Mail, label: "General", email: "contact@glaspolitics.ie" },
  { icon: Shield, label: "Privacy & data", email: "privacy@glaspolitics.ie" },
  { icon: Bug, label: "Technical support", email: "support@glaspolitics.ie" },
];

const FAQS = [
  {
    q: "How do I delete my account and data?",
    a: (
      <>
        You can delete your account in your <Link href="/profile" className="font-semibold text-primary underline underline-offset-2">Profile Settings</Link>. All your personal data will be permanently deleted within 30 days in compliance with GDPR.
      </>
    ),
  },
  {
    q: "I found incorrect information about a TD. How do I report it?",
    a: (
      <>
        Use the contact form above with subject "Data Correction" or email us at <a href="mailto:contact@glaspolitics.ie" className="font-semibold text-primary underline underline-offset-2">contact@glaspolitics.ie</a> with details. We review all correction requests within 48 hours.
      </>
    ),
  },
  {
    q: "Is my quiz data private?",
    a: "Yes! Your quiz results are private by default. You can optionally share them via a link, but they're never publicly associated with your identity.",
  },
  {
    q: "How can I support Glas Politics?",
    a: "Share the platform with friends, submit ideas, and provide feedback! We're currently free and ad-free. Future support options may include donations or premium features.",
  },
  {
    q: "Can I use Glas Politics data for research or journalism?",
    a: (
      <>
        Please contact us at <a href="mailto:contact@glaspolitics.ie" className="font-semibold text-primary underline underline-offset-2">contact@glaspolitics.ie</a> for media inquiries, research partnerships, or data access requests. We're open to collaboration!
      </>
    ),
  },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "general",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setIsSubmitted(true);
      setFormData({ name: "", email: "", subject: "general", message: "" });
    } catch (err) {
      setError('Something went wrong on our side. Your message is still here, so you can try again or email us directly at contact@glaspolitics.ie.');
      console.error('Contact form error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const valid = formData.name.trim() !== "" && formData.email.includes("@") && formData.message.trim() !== "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Contact & support" description="We're here to help! Get in touch with the Glas Politics team." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {QUICK_CONTACTS.map(({ icon: Icon, label, email }) => (
          <a
            key={email}
            href={`mailto:${email}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-bold">{label}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </span>
          </a>
        ))}
      </div>

      <section aria-labelledby="h-form" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 id="h-form" className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          Send us a message
        </h2>

        {isSubmitted ? (
          <div role="status" className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-success" aria-hidden="true">
              <Send className="h-7 w-7" />
            </span>
            <h3 className="font-display text-xl font-bold tracking-tight">Message sent</h3>
            <p className="text-sm text-muted-foreground">We'll reply within 1–2 working days.</p>
            <Button variant="outline" onClick={() => setIsSubmitted(false)}>
              Send another
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="First and last name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Your email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Topic</Label>
              <Select
                value={formData.subject}
                onValueChange={(value) => setFormData({ ...formData, subject: value })}
              >
                <SelectTrigger id="subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General inquiry</SelectItem>
                  <SelectItem value="bug">Bug report</SelectItem>
                  <SelectItem value="feature">Feature request</SelectItem>
                  <SelectItem value="data">Data correction (TD/party info)</SelectItem>
                  <SelectItem value="privacy">Privacy/GDPR request</SelectItem>
                  <SelectItem value="abuse">Report abuse/content issue</SelectItem>
                  <SelectItem value="partnership">Partnership/media inquiry</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={6}
                placeholder="Tell us how we can help..."
                className="resize-none"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Message not sent</AlertTitle>
                <AlertDescription>
                  {error}
                  <a href="mailto:contact@glaspolitics.ie" className="mt-2 block font-semibold underline underline-offset-2">
                    Email contact@glaspolitics.ie instead
                  </a>
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isSubmitting || !valid} className="h-12 w-full gap-2">
              <Send className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? 'Sending...' : 'Send message'}
            </Button>
            {!valid && (
              <p className="text-center text-[13px] text-muted-foreground">Add your name, email and message to send.</p>
            )}
          </form>
        )}
      </section>

      <section aria-labelledby="h-faq" className="flex flex-col gap-3">
        <h2 id="h-faq" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight sm:text-2xl">
          <HelpCircle className="h-6 w-6" aria-hidden="true" />
          Frequently asked questions
        </h2>

        <div className="flex flex-col gap-3">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group rounded-xl border border-border bg-card p-4">
              <summary className="cursor-pointer list-none font-semibold marker:content-none">
                {faq.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <nav aria-label="More information" className="flex flex-wrap gap-2">
        <Link href="/privacy-policy" className="flex h-11 items-center gap-1 rounded-full border border-input px-4 text-sm font-semibold transition-colors hover:bg-accent">
          Privacy policy
        </Link>
        <Link href="/terms-of-service" className="flex h-11 items-center gap-1 rounded-full border border-input px-4 text-sm font-semibold transition-colors hover:bg-accent">
          Terms of service
        </Link>
        <Link href="/profile" className="flex h-11 items-center gap-1 rounded-full border border-input px-4 text-sm font-semibold transition-colors hover:bg-accent">
          Profile settings
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}
