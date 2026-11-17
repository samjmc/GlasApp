import { CONTACT_EMAIL, SUPPORT_EMAIL, PRIVACY_EMAIL } from "@shared/contact";
export const CONTACT_TOPICS = [
  { value: "general", label: "General inquiry", to: CONTACT_EMAIL },
  { value: "bug", label: "Bug report", to: SUPPORT_EMAIL },
  { value: "feature", label: "Feature request", to: CONTACT_EMAIL },
  { value: "data", label: "Data correction (TD/party info)", to: CONTACT_EMAIL },
  { value: "privacy", label: "Privacy/GDPR request", to: PRIVACY_EMAIL },
  { value: "abuse", label: "Report abuse/content issue", to: SUPPORT_EMAIL },
  { value: "partnership", label: "Partnership/media inquiry", to: CONTACT_EMAIL },
  { value: "other", label: "Other", to: CONTACT_EMAIL },
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
