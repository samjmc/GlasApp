import { Link } from "wouter";
import { Shield, Lock, Eye, Database, UserCheck, Mail } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last Updated: {new Date().toLocaleDateString('en-IE', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="prose prose-lg dark:prose-invert max-w-none">
        {/* Introduction */}
        <section className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-0">
                Your Privacy Matters
              </h2>
              <p className="text-gray-700 dark:text-gray-300">
                Glas Politics ("we," "our," or "us") is committed to protecting your privacy and ensuring transparency about how we collect, use, and protect your personal data. This Privacy Policy complies with the EU General Data Protection Regulation (GDPR), the Irish Data Protection Act 2018, and the California Consumer Privacy Act (CCPA).
              </p>
            </div>
          </div>
        </section>

        {/* Data Controller */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <UserCheck className="w-6 h-6" />
            Data Controller
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The data controller responsible for your personal data is:
          </p>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Glas Politics</strong><br />
              Ireland<br />
              Email: privacy@glaspolitics.ie<br />
              Contact Form: <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">glaspolitics.ie/contact</Link>
            </p>
          </div>
        </section>

        {/* What Data We Collect */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Database className="w-6 h-6" />
            What Data We Collect
          </h2>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            1. Account Information
          </h3>
          <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Name (if provided)</li>
            <li>Email address</li>
            <li>Authentication provider data (Google, Microsoft)</li>
            <li>Profile picture (if using social login)</li>
            <li>Account creation date</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            2. Political Preferences & Quiz Data
          </h3>
          <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Political quiz responses and results</li>
            <li>Political dimension scores (economic, social, environmental, etc.)</li>
            <li>Party matching preferences</li>
            <li>Saved TD (Teachta Dála) rankings and ratings</li>
            <li>Personal political profile history</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            3. Location Data
          </h3>
          <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Constituency information (if provided)</li>
            <li>Electoral district (for personalized TD recommendations)</li>
            <li>IP-based location (country/region only, for analytics)</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            4. User-Generated Content
          </h3>
          <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Ideas and policy suggestions submitted</li>
            <li>Comments and feedback</li>
            <li>Support messages</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            5. Technical & Usage Data
          </h3>
          <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Device information (browser type, operating system)</li>
            <li>IP address (anonymized after 90 days)</li>
            <li>Pages visited and features used</li>
            <li>Session duration and interaction times</li>
            <li>Referral sources</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            6. Cookies & Tracking Technologies
          </h3>
          <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
            <li>Essential cookies (authentication, preferences)</li>
            <li>Analytics cookies (optional, requires consent)</li>
            <li>Local storage data (quiz progress, settings)</li>
          </ul>
        </section>

        {/* How We Use Your Data */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Eye className="w-6 h-6" />
            How We Use Your Data
          </h2>
          
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Legal Basis & Purpose
              </h3>
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Purpose</th>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Legal Basis (GDPR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Provide core platform services (quiz, rankings, profiles)
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Contract Performance (Art. 6(1)(b))
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Personalized recommendations and insights
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Legitimate Interest (Art. 6(1)(f))
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Send account notifications and updates
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Contract Performance (Art. 6(1)(b))
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Analytics and platform improvement
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Consent (Art. 6(1)(a))
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Prevent fraud and ensure security
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Legal Obligation (Art. 6(1)(c))
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Respond to support requests
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      Legitimate Interest (Art. 6(1)(f))
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="font-semibold">
              We will NEVER:
            </p>
            <ul className="list-disc pl-6">
              <li>Sell your personal data to third parties</li>
              <li>Share your political views with employers, insurers, or government agencies without legal obligation</li>
              <li>Use your data for targeted political advertising</li>
              <li>Disclose your identity in public rankings or analytics</li>
            </ul>
          </div>
        </section>

        {/* Data Sharing */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Lock className="w-6 h-6" />
            Who We Share Data With
          </h2>
          
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Service Providers (Data Processors)
            </h3>
            <ul className="list-disc pl-6">
              <li><strong>Supabase:</strong> Database hosting and authentication (EU region: eu-west-1)</li>
              <li><strong>Google/Microsoft:</strong> Social authentication (OAuth only)</li>
              <li><strong>Analytics Provider:</strong> Anonymized usage analytics (if you consent)</li>
              <li><strong>Email Service:</strong> Transactional emails (account verification, notifications)</li>
            </ul>

            <p className="font-semibold">
              All third-party processors:
            </p>
            <ul className="list-disc pl-6">
              <li>Are GDPR-compliant with Data Processing Agreements (DPAs)</li>
              <li>Store EU user data in EU/EEA data centers where possible</li>
              <li>Use appropriate security measures (encryption, access controls)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-4">
              Legal Disclosures
            </h3>
            <p>
              We may disclose your data if legally required (court order, law enforcement request) or to protect our rights, safety, or the rights of others.
            </p>
          </div>
        </section>

        {/* Data Retention */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Data Retention Policy
          </h2>
          
          <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Data Type</th>
                <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Retention Period</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Account information</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Until account deletion + 30 days</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Quiz results & political profiles</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Until account deletion + 30 days</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">User-generated content (ideas, comments)</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Until deletion request or 5 years of inactivity</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Analytics data (anonymized)</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">26 months (Google Analytics standard)</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">IP addresses</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">90 days (then anonymized)</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Backup copies</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">30 days (then permanently deleted)</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Your Rights */}
        <section className="mb-8 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
            Your GDPR Rights
          </h2>
          
          <div className="space-y-3 text-gray-700 dark:text-gray-300">
            <div>
              <p className="font-semibold">🔓 Right to Access (Art. 15)</p>
              <p>Request a copy of all personal data we hold about you.</p>
            </div>
            <div>
              <p className="font-semibold">✏️ Right to Rectification (Art. 16)</p>
              <p>Correct inaccurate or incomplete data in your profile settings.</p>
            </div>
            <div>
              <p className="font-semibold">🗑️ Right to Erasure / "Right to be Forgotten" (Art. 17)</p>
              <p>Delete your account and all associated data (available in profile settings).</p>
            </div>
            <div>
              <p className="font-semibold">⏸️ Right to Restriction of Processing (Art. 18)</p>
              <p>Temporarily suspend processing while we verify data accuracy.</p>
            </div>
            <div>
              <p className="font-semibold">📦 Right to Data Portability (Art. 20)</p>
              <p>Export your data in JSON format (available in profile settings).</p>
            </div>
            <div>
              <p className="font-semibold">🚫 Right to Object (Art. 21)</p>
              <p>Object to processing based on legitimate interests or direct marketing.</p>
            </div>
            <div>
              <p className="font-semibold">🤖 Rights Related to Automated Decision-Making (Art. 22)</p>
              <p>We do not use fully automated decision-making with legal effects. Quiz results are advisory only.</p>
            </div>

            <p className="mt-4 font-semibold">
              To exercise your rights:
            </p>
            <ul className="list-disc pl-6">
              <li>Visit your <Link href="/profile" className="text-blue-600 dark:text-blue-400 hover:underline">Profile Settings</Link> for self-service options</li>
              <li>Email us at <a href="mailto:privacy@glaspolitics.ie" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@glaspolitics.ie</a></li>
              <li>Use our <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">Contact Form</Link></li>
            </ul>

            <p className="text-sm italic mt-4">
              We will respond to all requests within 30 days as required by GDPR.
            </p>
          </div>
        </section>

        {/* Security */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Lock className="w-6 h-6" />
            Data Security
          </h2>
          
          <div className="space-y-3 text-gray-700 dark:text-gray-300">
            <p>We implement industry-standard security measures:</p>
            <ul className="list-disc pl-6">
              <li><strong>Encryption:</strong> All data transmitted via HTTPS/TLS 1.3</li>
              <li><strong>Database:</strong> Encrypted at rest in Supabase (AES-256)</li>
              <li><strong>Authentication:</strong> OAuth 2.0 with secure token storage</li>
              <li><strong>Access Controls:</strong> Role-based access for internal systems</li>
              <li><strong>Regular Audits:</strong> Security reviews and vulnerability scanning</li>
              <li><strong>Incident Response:</strong> Breach notification within 72 hours (GDPR Art. 33)</li>
            </ul>
          </div>
        </section>

        {/* Children's Privacy */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Children's Privacy
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            Glas Politics is not intended for users under 18 years of age. We do not knowingly collect personal data from children. If we discover we have collected data from a child, we will delete it immediately. Parents/guardians who believe we may have data from a child should contact us at <a href="mailto:privacy@glaspolitics.ie" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@glaspolitics.ie</a>.
          </p>
        </section>

        {/* International Transfers */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            International Data Transfers
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            We primarily store EU user data within the EU/EEA. If data is transferred outside the EU:
          </p>
          <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300">
            <li>We use EU Standard Contractual Clauses (SCCs)</li>
            <li>Processors are certified under the EU-US Data Privacy Framework (if applicable)</li>
            <li>We conduct Transfer Impact Assessments (TIAs) as required</li>
          </ul>
        </section>

        {/* Cookies */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Cookie Policy
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            We use cookies and similar technologies. See our cookie banner for full control. Types of cookies:
          </p>
          
          <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Cookie Type</th>
                <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Purpose</th>
                <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Required?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Essential</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Authentication, security, preferences</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Yes</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Analytics</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Usage statistics, performance monitoring</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">No (requires consent)</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Functional</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Remember settings, quiz progress</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">No (requires consent)</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Changes to Policy */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Changes to This Policy
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            We may update this Privacy Policy to reflect changes in our practices or legal requirements. We will notify you of significant changes via email or in-app notification. Continued use of Glas Politics after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        {/* Supervisory Authority */}
        <section className="mb-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Mail className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            Complaints & Supervisory Authority
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            If you believe we have not handled your data properly, you have the right to lodge a complaint with:
          </p>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-gray-700 dark:text-gray-300">
            <p>
              <strong>Data Protection Commission (Ireland)</strong><br />
              21 Fitzwilliam Square South, Dublin 2, D02 RD28, Ireland<br />
              Phone: +353 (0)761 104 800 or Lo-Call 1890 252 231<br />
              Email: <a href="mailto:info@dataprotection.ie" className="text-blue-600 dark:text-blue-400 hover:underline">info@dataprotection.ie</a><br />
              Website: <a href="https://www.dataprotection.ie" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">www.dataprotection.ie</a>
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
            We encourage you to contact us first at <a href="mailto:privacy@glaspolitics.ie" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@glaspolitics.ie</a> so we can resolve your concerns directly.
          </p>
        </section>

        {/* Contact */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Mail className="w-6 h-6" />
            Contact Us
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            For any privacy-related questions or to exercise your GDPR rights:
          </p>
          <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300">
            <li>Email: <a href="mailto:privacy@glaspolitics.ie" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@glaspolitics.ie</a></li>
            <li>Contact Form: <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">glaspolitics.ie/contact</Link></li>
            <li>Profile Settings: <Link href="/profile" className="text-blue-600 dark:text-blue-400 hover:underline">Self-service data export/deletion</Link></li>
          </ul>
        </section>
      </div>

      {/* Back to Home */}
      <div className="mt-12 text-center">
        <Link href="/">
          <button className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Back to Home
          </button>
        </Link>
      </div>
    </div>
  );
}






















