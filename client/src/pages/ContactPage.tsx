import { useState } from "react";
import { Link } from "wouter";
import { Mail, MessageCircle, Shield, Bug, Lightbulb, HelpCircle, Send, CheckCircle } from "lucide-react";

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
      setError('Failed to send message. Please try emailing us directly at contact@glaspolitics.ie');
      console.error('Contact form error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Contact & Support
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          We're here to help! Get in touch with the Glas Politics team.
        </p>
      </div>

      {/* Quick Contact Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              General Inquiries
            </h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
            Questions about the platform, features, or partnerships?
          </p>
          <a 
            href="mailto:contact@glaspolitics.ie"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
          >
            contact@glaspolitics.ie
          </a>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Privacy & Data
            </h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
            GDPR requests, data deletion, or privacy concerns?
          </p>
          <a 
            href="mailto:privacy@glaspolitics.ie"
            className="text-green-600 dark:text-green-400 hover:underline text-sm font-medium"
          >
            privacy@glaspolitics.ie
          </a>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <Bug className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Technical Support
            </h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
            Bug reports, technical issues, or legal matters?
          </p>
          <a 
            href="mailto:support@glaspolitics.ie"
            className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium"
          >
            support@glaspolitics.ie
          </a>
        </div>
      </div>

      {/* Contact Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 mb-12">
        <div className="flex items-center gap-3 mb-6">
          <MessageCircle className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Send Us a Message
          </h2>
        </div>

        {isSubmitted ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Message Sent!
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              We'll get back to you within 1-2 business days.
            </p>
            <button
              onClick={() => setIsSubmitted(false)}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="john@example.com"
              />
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subject
              </label>
              <select
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="general">General Inquiry</option>
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="data">Data Correction (TD/Party Info)</option>
                <option value="privacy">Privacy/GDPR Request</option>
                <option value="abuse">Report Abuse/Content Issue</option>
                <option value="partnership">Partnership/Media Inquiry</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                placeholder="Tell us how we can help..."
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-400 text-sm">
                  {error}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Message
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* FAQ Section */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <HelpCircle className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          <details className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer">
              How do I delete my account and data?
            </summary>
            <p className="mt-3 text-gray-700 dark:text-gray-300">
              You can delete your account in your <Link href="/profile" className="text-blue-600 dark:text-blue-400 hover:underline">Profile Settings</Link>. All your personal data will be permanently deleted within 30 days in compliance with GDPR.
            </p>
          </details>

          <details className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer">
              How is TD/Party data collected and scored?
            </summary>
            <p className="mt-3 text-gray-700 dark:text-gray-300">
              We aggregate data from official sources (Oireachtas records, news articles, social media) and use AI to analyze political alignment and performance. Read more in our <Link href="/methodology" className="text-blue-600 dark:text-blue-400 hover:underline">Methodology</Link> page.
            </p>
          </details>

          <details className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer">
              I found incorrect information about a TD. How do I report it?
            </summary>
            <p className="mt-3 text-gray-700 dark:text-gray-300">
              Use the contact form above with subject "Data Correction" or email us at <a href="mailto:contact@glaspolitics.ie" className="text-blue-600 dark:text-blue-400 hover:underline">contact@glaspolitics.ie</a> with details. We review all correction requests within 48 hours.
            </p>
          </details>

          <details className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer">
              Is my quiz data private?
            </summary>
            <p className="mt-3 text-gray-700 dark:text-gray-300">
              Yes! Your quiz results are private by default. You can optionally share them via a link, but they're never publicly associated with your identity. See our <Link href="/privacy-policy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link> for details.
            </p>
          </details>

          <details className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer">
              How can I support Glas Politics?
            </summary>
            <p className="mt-3 text-gray-700 dark:text-gray-300">
              Share the platform with friends, submit ideas, and provide feedback! We're currently free and ad-free. Future support options may include donations or premium features.
            </p>
          </details>

          <details className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer">
              Can I use Glas Politics data for research or journalism?
            </summary>
            <p className="mt-3 text-gray-700 dark:text-gray-300">
              Please contact us at <a href="mailto:contact@glaspolitics.ie" className="text-blue-600 dark:text-blue-400 hover:underline">contact@glaspolitics.ie</a> for media inquiries, research partnerships, or data access requests. We're open to collaboration!
            </p>
          </details>
        </div>
      </div>

      {/* Additional Resources */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-12">
        <div className="flex items-center gap-3 mb-4">
          <Lightbulb className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Additional Resources
          </h2>
        </div>
        <ul className="space-y-2 text-gray-700 dark:text-gray-300">
          <li>
            <Link href="/privacy-policy" className="text-blue-600 dark:text-blue-400 hover:underline">
              Privacy Policy (GDPR Compliance)
            </Link>
          </li>
          <li>
            <Link href="/terms-of-service" className="text-blue-600 dark:text-blue-400 hover:underline">
              Terms of Service
            </Link>
          </li>
          <li>
            <Link href="/methodology" className="text-blue-600 dark:text-blue-400 hover:underline">
              Scoring Methodology
            </Link>
          </li>
          <li>
            <Link href="/profile" className="text-blue-600 dark:text-blue-400 hover:underline">
              Profile Settings (Data Export/Deletion)
            </Link>
          </li>
        </ul>
      </div>

      {/* Back to Home */}
      <div className="text-center">
        <Link href="/">
          <button className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Back to Home
          </button>
        </Link>
      </div>
    </div>
  );
}






















