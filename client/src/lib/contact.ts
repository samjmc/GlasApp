export const CONTACT_TOPICS = [
  { value: "general", label: "General inquiry", to: "contact@glaspolitics.ie" },
  { value: "bug", label: "Bug report", to: "support@glaspolitics.ie" },
  { value: "feature", label: "Feature request", to: "contact@glaspolitics.ie" },
  { value: "data", label: "Data correction (TD/party info)", to: "contact@glaspolitics.ie" },
  { value: "privacy", label: "Privacy/GDPR request", to: "privacy@glaspolitics.ie" },
  { value: "abuse", label: "Report abuse/content issue", to: "support@glaspolitics.ie" },
  { value: "partnership", label: "Partnership/media inquiry", to: "contact@glaspolitics.ie" },
  { value: "other", label: "Other", to: "contact@glaspolitics.ie" },
];

/**
 * There is no mail service behind the site, so the contact form writes the email and hands it
 * to the visitor's own mail app. Nothing claims a message was sent.
 */
export function buildMailto(form: { name: string; subject: string; message: string }) {
  const topic = CONTACT_TOPICS.find((t) => t.value === form.subject) ?? CONTACT_TOPICS[0];
  const subject = `${topic.label} from ${form.name.trim()}`;
  const body = `${form.message.trim()}\n\n${form.name.trim()}`;
  return {
    to: topic.to,
    href: `mailto:${topic.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}
