import { Link } from "wouter";
import { Scale, AlertTriangle, CheckCircle, XCircle, Shield, FileText } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Terms of Service
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last Updated: {new Date().toLocaleDateString('en-IE', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="prose prose-lg dark:prose-invert max-w-none">
        {/* Agreement */}
        <section className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-0">
                Agreement to Terms
              </h2>
              <p className="text-gray-700 dark:text-gray-300">
                By accessing or using Glas Politics ("Platform," "we," "our," or "us"), you agree to be bound by these Terms of Service and our <Link href="/privacy-policy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link>. If you do not agree, please do not use our Platform.
              </p>
            </div>
          </div>
        </section>

        {/* Service Description */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            What Glas Politics Provides
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Glas Politics is a civic engagement platform that helps Irish citizens:
          </p>
          <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
            <li>Discover their political alignment through multidimensional quizzes</li>
            <li>Explore party and TD (Teachta Dála) profiles, voting records, and performance data</li>
            <li>Access news articles with AI-powered political impact scoring</li>
            <li>View polling data and electoral analytics</li>
            <li>Submit policy ideas and engage with the community</li>
            <li>Track political trends and constituency information</li>
          </ul>
        </section>

        {/* Important Disclaimers */}
        <section className="mb-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            Important Disclaimers
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                📊 No Voting Advice
              </h3>
              <p>
                Glas Politics provides <strong>informational tools only</strong>. We do NOT tell you how to vote. Quiz results, party matches, and TD rankings are educational resources to help you explore your political views—not instructions or endorsements.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                🤖 AI-Generated Content
              </h3>
              <p>
                Some content (news summaries, TD scores, policy impact analysis) is generated using artificial intelligence. While we strive for accuracy, AI may occasionally produce errors, biases, or incomplete information. <strong>Always verify critical information from original sources.</strong>
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                📰 Third-Party Content
              </h3>
              <p>
                News articles, TD voting records, and other political data come from external sources. We aggregate and analyze this data but do not control its accuracy. We are not responsible for errors in source material.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                🗳️ Not a Substitute for Research
              </h3>
              <p>
                Voting is a serious responsibility. Our platform is a starting point for political education, not a replacement for thorough research, reading party manifestos, or attending candidate debates.
              </p>
            </div>
          </div>
        </section>

        {/* User Eligibility */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6" />
            User Eligibility
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            You must meet the following requirements to use Glas Politics:
          </p>
          <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300">
            <li>Be at least 18 years of age</li>
            <li>Provide accurate and truthful information when creating an account</li>
            <li>Not use the Platform for illegal or harmful purposes</li>
            <li>Comply with all applicable Irish and EU laws</li>
          </ul>
        </section>

        {/* Account Responsibilities */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Your Account Responsibilities
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Account Security
              </h3>
              <ul className="list-disc pl-6">
                <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                <li>You must notify us immediately of any unauthorized access</li>
                <li>You are liable for all activities under your account</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Accurate Information
              </h3>
              <ul className="list-disc pl-6">
                <li>Do not create fake accounts or impersonate others</li>
                <li>Update your profile information if it changes</li>
                <li>Provide a valid email address for account recovery</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Prohibited Activities */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <XCircle className="w-6 h-6" />
            Prohibited Activities
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            You agree NOT to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
            <li><strong>Manipulate Data:</strong> Vote stuffing, bot accounts, or artificially inflating TD/party scores</li>
            <li><strong>Abuse the Platform:</strong> Spamming, harassment, hate speech, or threatening behavior</li>
            <li><strong>Violate Privacy:</strong> Doxxing, sharing others' personal information without consent</li>
            <li><strong>Illegal Activity:</strong> Fraud, copyright infringement, or defamation</li>
            <li><strong>Scraping/Automation:</strong> Unauthorized automated access, web scraping, or API abuse</li>
            <li><strong>Reverse Engineering:</strong> Decompiling, disassembling, or hacking the Platform</li>
            <li><strong>Misinformation:</strong> Deliberately spreading false political information</li>
            <li><strong>Election Interference:</strong> Using the Platform for voter suppression or election fraud</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 mt-4 font-semibold">
            Violation of these terms may result in account suspension or permanent ban, and we may report illegal activity to authorities.
          </p>
        </section>

        {/* User-Generated Content */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            User-Generated Content
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Content You Submit
              </h3>
              <p>
                When you submit ideas, comments, or other content ("User Content"), you:
              </p>
              <ul className="list-disc pl-6">
                <li>Retain ownership of your content</li>
                <li>Grant us a non-exclusive, royalty-free, worldwide license to display, distribute, and analyze your content on the Platform</li>
                <li>Confirm you have the right to submit the content (not copyrighted by others)</li>
                <li>Agree your content does not violate Irish defamation law or any other laws</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Content Moderation
              </h3>
              <p>
                We reserve the right (but not the obligation) to:
              </p>
              <ul className="list-disc pl-6">
                <li>Review, monitor, or remove User Content that violates these Terms</li>
                <li>Suspend or ban users who repeatedly violate our policies</li>
                <li>Report illegal content to law enforcement</li>
              </ul>
              <p className="mt-2">
                We are not responsible for User Content and do not endorse any opinions expressed by users.
              </p>
            </div>
          </div>
        </section>

        {/* Intellectual Property */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Intellectual Property
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Our Content
              </h3>
              <p>
                All original content on Glas Politics (quiz questions, algorithms, design, branding, etc.) is owned by Glas Politics or licensed to us. You may not:
              </p>
              <ul className="list-disc pl-6">
                <li>Copy, modify, or redistribute our content without permission</li>
                <li>Use our trademarks or logos without authorization</li>
                <li>Claim our work as your own</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Third-Party Content
              </h3>
              <p>
                News articles, TD photos, and other third-party content remain the property of their original creators. We display this content under fair use for news reporting and political commentary. If you believe we are infringing your copyright, contact us at <a href="mailto:legal@glaspolitics.ie" className="text-blue-600 dark:text-blue-400 hover:underline">legal@glaspolitics.ie</a>.
              </p>
            </div>
          </div>
        </section>

        {/* Data Usage & Privacy */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Data Usage & Privacy
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            Your use of Glas Politics is subject to our <Link href="/privacy-policy" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">Privacy Policy</Link>. Key points:
          </p>
          <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300">
            <li>We collect political preference data to provide personalized recommendations</li>
            <li>Your quiz results are private by default (you can share them optionally)</li>
            <li>We never sell your data or share it with political campaigns</li>
            <li>You can delete your account and all data at any time</li>
          </ul>
        </section>

        {/* Disclaimer of Warranties */}
        <section className="mb-8 p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            Disclaimer of Warranties
          </h2>
          <p className="text-gray-700 dark:text-gray-300 uppercase font-semibold mb-4">
            IMPORTANT LEGAL NOTICE
          </p>
          <div className="text-gray-700 dark:text-gray-300 space-y-3">
            <p>
              <strong>THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND.</strong>
            </p>
            <p>
              We do not guarantee:
            </p>
            <ul className="list-disc pl-6">
              <li>100% accuracy of political data, TD scores, or news analysis</li>
              <li>Uninterrupted or error-free service</li>
              <li>Complete security (though we implement industry-standard protections)</li>
              <li>That quiz results perfectly match your political views</li>
            </ul>
            <p>
              <strong>USE AT YOUR OWN RISK.</strong> We are not liable for decisions you make based on information from our Platform.
            </p>
          </div>
        </section>

        {/* Limitation of Liability */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Scale className="w-6 h-6" />
            Limitation of Liability
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            <strong>TO THE MAXIMUM EXTENT PERMITTED BY IRISH AND EU LAW:</strong>
          </p>
          <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
            <li>Glas Politics, its founders, employees, and partners are <strong>NOT LIABLE</strong> for any indirect, incidental, consequential, or punitive damages</li>
            <li>This includes loss of data, loss of profits, or reputational harm arising from your use of the Platform</li>
            <li>Our total liability to you for any claim shall not exceed €100 or the amount you paid us (whichever is greater)</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 mt-4 text-sm">
            <em>Note: This limitation does not affect your statutory rights as a consumer under Irish/EU law (e.g., rights under GDPR, defective products, fraud).</em>
          </p>
        </section>

        {/* Indemnification */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Indemnification
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            You agree to indemnify (compensate) and hold Glas Politics harmless from any claims, losses, or expenses (including legal fees) arising from:
          </p>
          <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300">
            <li>Your violation of these Terms</li>
            <li>Your User Content (e.g., if someone sues us for defamation based on your post)</li>
            <li>Your misuse of the Platform</li>
          </ul>
        </section>

        {/* Changes to Service */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Changes to the Platform & Terms
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Platform Changes
              </h3>
              <p>
                We may add, modify, or discontinue features at any time. We are not obligated to provide advance notice for non-material changes.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Terms Updates
              </h3>
              <p>
                We may update these Terms periodically. We will notify you of significant changes via email or in-app notification. Continued use after changes constitutes acceptance. If you disagree, please stop using the Platform.
              </p>
            </div>
          </div>
        </section>

        {/* Account Termination */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Account Termination
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Your Right to Terminate
              </h3>
              <p>
                You may delete your account at any time through your <Link href="/profile" className="text-blue-600 dark:text-blue-400 hover:underline">Profile Settings</Link>. Upon deletion:
              </p>
              <ul className="list-disc pl-6">
                <li>Your personal data will be permanently deleted within 30 days</li>
                <li>Anonymized analytics data may be retained</li>
                <li>Public content (ideas, comments) may remain visible but anonymized</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Our Right to Terminate
              </h3>
              <p>
                We may suspend or terminate your account if you:
              </p>
              <ul className="list-disc pl-6">
                <li>Violate these Terms of Service</li>
                <li>Engage in illegal activity</li>
                <li>Threaten the security or integrity of the Platform</li>
                <li>Are inactive for more than 5 years</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Dispute Resolution */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Scale className="w-6 h-6" />
            Dispute Resolution & Governing Law
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Governing Law
              </h3>
              <p>
                These Terms are governed by the laws of <strong>Ireland</strong> and the <strong>European Union</strong>. Any disputes will be resolved in Irish courts.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Informal Resolution
              </h3>
              <p>
                Before filing a lawsuit, please contact us at <a href="mailto:legal@glaspolitics.ie" className="text-blue-600 dark:text-blue-400 hover:underline">legal@glaspolitics.ie</a> to resolve the issue informally. Most disputes can be settled through good-faith negotiation.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                EU Alternative Dispute Resolution
              </h3>
              <p>
                EU consumers may access the <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">European Commission's Online Dispute Resolution (ODR) platform</a> for resolving consumer disputes.
              </p>
            </div>
          </div>
        </section>

        {/* Miscellaneous */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Miscellaneous
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Severability
              </h3>
              <p>
                If any provision of these Terms is found invalid, the remaining provisions remain in full effect.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                No Waiver
              </h3>
              <p>
                Our failure to enforce any right or provision does not constitute a waiver of that right.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Assignment
              </h3>
              <p>
                You may not transfer your account or rights under these Terms. We may assign our rights to a successor entity (e.g., in a merger).
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Entire Agreement
              </h3>
              <p>
                These Terms, together with our Privacy Policy, constitute the entire agreement between you and Glas Politics.
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="mb-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Questions About These Terms?
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            If you have questions or concerns about these Terms of Service:
          </p>
          <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300">
            <li>Email: <a href="mailto:legal@glaspolitics.ie" className="text-blue-600 dark:text-blue-400 hover:underline">legal@glaspolitics.ie</a></li>
            <li>Contact Form: <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">glaspolitics.ie/contact</Link></li>
          </ul>
        </section>

        {/* Acceptance */}
        <section className="mb-8 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            By Using Glas Politics, You Agree
          </h2>
          <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
            <li>You have read and understood these Terms</li>
            <li>You are at least 18 years old</li>
            <li>You will use the Platform responsibly and legally</li>
            <li>You understand our disclaimers and limitations of liability</li>
            <li>You agree to resolve disputes under Irish/EU law</li>
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






















