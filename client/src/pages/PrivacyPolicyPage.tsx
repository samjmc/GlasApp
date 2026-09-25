import { Link } from "wouter";
import { Shield, Lock, Eye, Database, UserCheck, Mail } from "lucide-react";
import { LegalLayout, type LegalTocEntry } from "@/components/account/LegalLayout";

const TOC: LegalTocEntry[] = [
  { id: "controller", label: "Data controller" },
  { id: "collect", label: "What data we collect" },
  { id: "use", label: "How we use your data" },
  { id: "sharing", label: "Who we share data with" },
  { id: "retention", label: "Data retention" },
  { id: "rights", label: "Your GDPR rights" },
  { id: "security", label: "Data security" },
  { id: "children", label: "Children's privacy" },
  { id: "transfers", label: "International transfers" },
  { id: "cookies", label: "Cookie policy" },
  { id: "changes", label: "Changes to this policy" },
  { id: "complaints", label: "Complaints & supervisory authority" },
  { id: "contact", label: "Contact us" },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      lastUpdated={new Date().toLocaleDateString('en-IE', { year: 'numeric', month: 'long', day: 'numeric' })}
      toc={TOC}
    >
      <section className="flex items-start gap-3 rounded-xl border border-border bg-elevated p-6">
        <Shield className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 className="mb-2">Your Privacy Matters</h2>
          <p>
            Glas Politics ("we," "our," or "us") is committed to protecting your privacy and ensuring transparency about how we collect, use, and protect your personal data. This Privacy Policy complies with the EU General Data Protection Regulation (GDPR), the Irish Data Protection Act 2018, and the California Consumer Privacy Act (CCPA).
          </p>
        </div>
      </section>

      <section id="controller" className="scroll-mt-24">
        <h2 className="mb-4 flex items-center gap-2"><UserCheck className="h-6 w-6" aria-hidden="true" />Data Controller</h2>
        <p className="mb-4">
          The data controller responsible for your personal data is:
        </p>
        <div className="rounded-lg bg-elevated p-4">
          <p>
            <strong className="text-foreground">Glas Politics</strong><br />
            Ireland<br />
            Email: privacy@glaspolitics.ie<br />
            Contact Form: <Link href="/contact">glaspolitics.ie/contact</Link>
          </p>
        </div>
      </section>

      <section id="collect" className="scroll-mt-24">
        <h2 className="mb-4 flex items-center gap-2"><Database className="h-6 w-6" aria-hidden="true" />What Data We Collect</h2>

        <h3 className="mb-3">1. Account Information</h3>
        <ul className="mb-4">
          <li>Name (if provided)</li>
          <li>Email address</li>
          <li>Authentication provider data (Google, Microsoft)</li>
          <li>Profile picture (if using social login)</li>
          <li>Account creation date</li>
        </ul>

        <h3 className="mb-3">2. Political Preferences &amp; Quiz Data</h3>
        <ul className="mb-4">
          <li>Political quiz responses and results</li>
          <li>Political dimension scores (economic, social, environmental, etc.)</li>
          <li>Party matching preferences</li>
          <li>Saved TD (Teachta Dála) rankings and ratings</li>
          <li>Personal political profile history</li>
        </ul>

        <h3 className="mb-3">3. Location Data</h3>
        <ul className="mb-4">
          <li>Constituency information (if provided)</li>
          <li>Electoral district (for personalized TD recommendations)</li>
          <li>IP-based location (country/region only, for analytics)</li>
        </ul>

        <h3 className="mb-3">4. User-Generated Content</h3>
        <ul className="mb-4">
          <li>Ideas and policy suggestions submitted</li>
          <li>Comments and feedback</li>
          <li>Support messages</li>
        </ul>

        <h3 className="mb-3">5. Technical &amp; Usage Data</h3>
        <ul className="mb-4">
          <li>Device information (browser type, operating system)</li>
          <li>IP address (anonymized after 90 days)</li>
          <li>Pages visited and features used</li>
          <li>Session duration and interaction times</li>
          <li>Referral sources</li>
        </ul>

        <h3 className="mb-3">6. Cookies &amp; Tracking Technologies</h3>
        <ul className="mb-4">
          <li>Essential cookies (authentication, preferences)</li>
          <li>Analytics cookies (optional, requires consent)</li>
          <li>Local storage data (quiz progress, settings)</li>
        </ul>
      </section>

      <section id="use" className="scroll-mt-24">
        <h2 className="mb-4 flex items-center gap-2"><Eye className="h-6 w-6" aria-hidden="true" />How We Use Your Data</h2>

        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-2">Legal Basis &amp; Purpose</h3>
            <table>
              <thead className="bg-elevated">
                <tr>
                  <th>Purpose</th>
                  <th>Legal Basis (GDPR)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Provide core platform services (quiz, rankings, profiles)</td>
                  <td>Contract Performance (Art. 6(1)(b))</td>
                </tr>
                <tr>
                  <td>Personalized recommendations and insights</td>
                  <td>Legitimate Interest (Art. 6(1)(f))</td>
                </tr>
                <tr>
                  <td>Send account notifications and updates</td>
                  <td>Contract Performance (Art. 6(1)(b))</td>
                </tr>
                <tr>
                  <td>Analytics and platform improvement</td>
                  <td>Consent (Art. 6(1)(a))</td>
                </tr>
                <tr>
                  <td>Prevent fraud and ensure security</td>
                  <td>Legal Obligation (Art. 6(1)(c))</td>
                </tr>
                <tr>
                  <td>Respond to support requests</td>
                  <td>Legitimate Interest (Art. 6(1)(f))</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="font-semibold text-foreground">
            We will NEVER:
          </p>
          <ul>
            <li>Sell your personal data to third parties</li>
            <li>Share your political views with employers, insurers, or government agencies without legal obligation</li>
            <li>Use your data for targeted political advertising</li>
            <li>Disclose your identity in public rankings or analytics</li>
          </ul>
        </div>
      </section>

      <section id="sharing" className="scroll-mt-24">
        <h2 className="mb-4 flex items-center gap-2"><Lock className="h-6 w-6" aria-hidden="true" />Who We Share Data With</h2>

        <div className="flex flex-col gap-4">
          <h3>Service Providers (Data Processors)</h3>
          <ul>
            <li><strong className="text-foreground">Supabase:</strong> Database hosting and authentication (EU region: eu-west-1)</li>
            <li><strong className="text-foreground">Google/Microsoft:</strong> Social authentication (OAuth only)</li>
            <li><strong className="text-foreground">Analytics Provider:</strong> Anonymized usage analytics (if you consent)</li>
            <li><strong className="text-foreground">Email Service:</strong> Transactional emails (account verification, notifications)</li>
          </ul>

          <p className="font-semibold text-foreground">
            All third-party processors:
          </p>
          <ul>
            <li>Are GDPR-compliant with Data Processing Agreements (DPAs)</li>
            <li>Store EU user data in EU/EEA data centers where possible</li>
            <li>Use appropriate security measures (encryption, access controls)</li>
          </ul>

          <h3>Legal Disclosures</h3>
          <p>
            We may disclose your data if legally required (court order, law enforcement request) or to protect our rights, safety, or the rights of others.
          </p>
        </div>
      </section>

      <section id="retention" className="scroll-mt-24">
        <h2 className="mb-4">Data Retention Policy</h2>

        <table>
          <thead className="bg-elevated">
            <tr>
              <th>Data Type</th>
              <th>Retention Period</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Account information</td>
              <td>Until account deletion + 30 days</td>
            </tr>
            <tr>
              <td>Quiz results &amp; political profiles</td>
              <td>Until account deletion + 30 days</td>
            </tr>
            <tr>
              <td>User-generated content (ideas, comments)</td>
              <td>Until deletion request or 5 years of inactivity</td>
            </tr>
            <tr>
              <td>Analytics data (anonymized)</td>
              <td>26 months (Google Analytics standard)</td>
            </tr>
            <tr>
              <td>IP addresses</td>
              <td>90 days (then anonymized)</td>
            </tr>
            <tr>
              <td>Backup copies</td>
              <td>30 days (then permanently deleted)</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="rights" className="scroll-mt-24 rounded-xl border border-success/40 bg-success/10 p-6">
        <h2 className="mb-4 flex items-center gap-2"><Shield className="h-6 w-6 text-success" aria-hidden="true" />Your GDPR Rights</h2>

        <div className="flex flex-col gap-3">
          <div>
            <p className="font-semibold text-foreground">Right to Access (Art. 15)</p>
            <p>Request a copy of all personal data we hold about you.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Right to Rectification (Art. 16)</p>
            <p>Correct inaccurate or incomplete data in your profile settings.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Right to Erasure / "Right to be Forgotten" (Art. 17)</p>
            <p>Delete your account and all associated data (available in profile settings).</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Right to Restriction of Processing (Art. 18)</p>
            <p>Temporarily suspend processing while we verify data accuracy.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Right to Data Portability (Art. 20)</p>
            <p>Export your data in JSON format (available in profile settings).</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Right to Object (Art. 21)</p>
            <p>Object to processing based on legitimate interests or direct marketing.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Rights Related to Automated Decision-Making (Art. 22)</p>
            <p>We do not use fully automated decision-making with legal effects. Quiz results are advisory only.</p>
          </div>

          <p className="mt-4 font-semibold text-foreground">
            To exercise your rights:
          </p>
          <ul>
            <li>Visit your <Link href="/profile">Profile Settings</Link> for self-service options</li>
            <li>Email us at <a href="mailto:privacy@glaspolitics.ie">privacy@glaspolitics.ie</a></li>
            <li>Use our <Link href="/contact">Contact Form</Link></li>
          </ul>

          <p className="mt-4 text-sm italic">
            We will respond to all requests within 30 days as required by GDPR.
          </p>
        </div>
      </section>

      <section id="security" className="scroll-mt-24">
        <h2 className="mb-4 flex items-center gap-2"><Lock className="h-6 w-6" aria-hidden="true" />Data Security</h2>

        <div className="flex flex-col gap-3">
          <p>We implement industry-standard security measures:</p>
          <ul>
            <li><strong className="text-foreground">Encryption:</strong> All data transmitted via HTTPS/TLS 1.3</li>
            <li><strong className="text-foreground">Database:</strong> Encrypted at rest in Supabase (AES-256)</li>
            <li><strong className="text-foreground">Authentication:</strong> OAuth 2.0 with secure token storage</li>
            <li><strong className="text-foreground">Access Controls:</strong> Role-based access for internal systems</li>
            <li><strong className="text-foreground">Regular Audits:</strong> Security reviews and vulnerability scanning</li>
            <li><strong className="text-foreground">Incident Response:</strong> Breach notification within 72 hours (GDPR Art. 33)</li>
          </ul>
        </div>
      </section>

      <section id="children" className="scroll-mt-24">
        <h2 className="mb-4">Children's Privacy</h2>
        <p>
          Glas Politics is not intended for users under 18 years of age. We do not knowingly collect personal data from children. If we discover we have collected data from a child, we will delete it immediately. Parents/guardians who believe we may have data from a child should contact us at <a href="mailto:privacy@glaspolitics.ie">privacy@glaspolitics.ie</a>.
        </p>
      </section>

      <section id="transfers" className="scroll-mt-24">
        <h2 className="mb-4">International Data Transfers</h2>
        <p className="mb-4">
          We primarily store EU user data within the EU/EEA. If data is transferred outside the EU:
        </p>
        <ul>
          <li>We use EU Standard Contractual Clauses (SCCs)</li>
          <li>Processors are certified under the EU-US Data Privacy Framework (if applicable)</li>
          <li>We conduct Transfer Impact Assessments (TIAs) as required</li>
        </ul>
      </section>

      <section id="cookies" className="scroll-mt-24">
        <h2 className="mb-4">Cookie Policy</h2>
        <p className="mb-4">
          We use cookies and similar technologies. See our cookie banner for full control. Types of cookies:
        </p>

        <table>
          <thead className="bg-elevated">
            <tr>
              <th>Cookie Type</th>
              <th>Purpose</th>
              <th>Required?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Essential</td>
              <td>Authentication, security, preferences</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>Analytics</td>
              <td>Usage statistics, performance monitoring</td>
              <td>No (requires consent)</td>
            </tr>
            <tr>
              <td>Functional</td>
              <td>Remember settings, quiz progress</td>
              <td>No (requires consent)</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="changes" className="scroll-mt-24">
        <h2 className="mb-4">Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy to reflect changes in our practices or legal requirements. We will notify you of significant changes via email or in-app notification. Continued use of Glas Politics after changes constitutes acceptance of the updated policy.
        </p>
      </section>

      <section id="complaints" className="scroll-mt-24 rounded-xl border border-warn/40 bg-warn/10 p-6">
        <h2 className="mb-4 flex items-center gap-2"><Mail className="h-6 w-6 text-warn" aria-hidden="true" />Complaints &amp; Supervisory Authority</h2>
        <p className="mb-4">
          If you believe we have not handled your data properly, you have the right to lodge a complaint with:
        </p>
        <div className="rounded-lg bg-elevated p-4">
          <p>
            <strong className="text-foreground">Data Protection Commission (Ireland)</strong><br />
            21 Fitzwilliam Square South, Dublin 2, D02 RD28, Ireland<br />
            Phone: +353 (0)761 104 800 or Lo-Call 1890 252 231<br />
            Email: <a href="mailto:info@dataprotection.ie">info@dataprotection.ie</a><br />
            Website: <a href="https://www.dataprotection.ie" target="_blank" rel="noopener noreferrer">www.dataprotection.ie</a>
          </p>
        </div>
        <p className="mt-4 text-sm">
          We encourage you to contact us first at <a href="mailto:privacy@glaspolitics.ie">privacy@glaspolitics.ie</a> so we can resolve your concerns directly.
        </p>
      </section>

      <section id="contact" className="scroll-mt-24">
        <h2 className="mb-4 flex items-center gap-2"><Mail className="h-6 w-6" aria-hidden="true" />Contact Us</h2>
        <p className="mb-4">
          For any privacy-related questions or to exercise your GDPR rights:
        </p>
        <ul>
          <li>Email: <a href="mailto:privacy@glaspolitics.ie">privacy@glaspolitics.ie</a></li>
          <li>Contact Form: <Link href="/contact">glaspolitics.ie/contact</Link></li>
          <li>Profile Settings: <Link href="/profile">Self-service data export/deletion</Link></li>
        </ul>
      </section>
    </LegalLayout>
  );
}
