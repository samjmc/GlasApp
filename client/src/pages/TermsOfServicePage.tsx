import { Link } from "wouter";
import { Scale, AlertTriangle, CheckCircle, XCircle, Shield, FileText } from "lucide-react";
import { LegalLayout, type LegalTocEntry } from "@/components/account/LegalLayout";

const TOC: LegalTocEntry[] = [
  { id: "provides", label: "What we provide" },
  { id: "disclaimers", label: "Important disclaimers" },
  { id: "eligibility", label: "User eligibility" },
  { id: "responsibilities", label: "Account responsibilities" },
  { id: "prohibited", label: "Prohibited activities" },
  { id: "content", label: "User-generated content" },
  { id: "ip", label: "Intellectual property" },
  { id: "data", label: "Data usage & privacy" },
  { id: "warranties", label: "Disclaimer of warranties" },
  { id: "liability", label: "Limitation of liability" },
  { id: "indemnification", label: "Indemnification" },
  { id: "changes", label: "Changes to the platform" },
  { id: "termination", label: "Account termination" },
  { id: "disputes", label: "Dispute resolution" },
  { id: "misc", label: "Miscellaneous" },
  { id: "contact", label: "Questions about these terms" },
];

export default function TermsOfServicePage() {
  return (
    <LegalLayout
      title="Terms of Service"
      lastUpdated={new Date().toLocaleDateString('en-IE', { year: 'numeric', month: 'long', day: 'numeric' })}
      toc={TOC}
    >
      <section className="flex items-start gap-3 rounded-xl border border-border bg-elevated p-6">
        <FileText className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 className="mb-2">Agreement to Terms</h2>
          <p>
            By accessing or using Glas Politics ("Platform," "we," "our," or "us"), you agree to be bound by these Terms of Service and our <Link href="/privacy-policy">Privacy Policy</Link>. If you do not agree, please do not use our Platform.
          </p>
        </div>
      </section>

      <section id="provides" className="scroll-mt-24">
        <h2 className="mb-4 flex items-center gap-2"><CheckCircle className="h-6 w-6" aria-hidden="true" />What Glas Politics Provides</h2>
        <p className="mb-4">
          Glas Politics is a civic engagement platform that helps Irish citizens:
        </p>
        <ul className="space-y-2">
          <li>Discover their political alignment through multidimensional quizzes</li>
          <li>Explore party and TD (Teachta Dála) profiles, voting records, and performance data</li>
          <li>Access news articles with AI-powered political impact scoring</li>
          <li>View polling data and electoral analytics</li>
          <li>Submit policy ideas and engage with the community</li>
          <li>Track political trends and constituency information</li>
        </ul>
      </section>

      <section id="disclaimers" className="scroll-mt-24 rounded-xl border border-warn/40 bg-warn/10 p-6">
        <h2 className="mb-4 flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-warn" aria-hidden="true" />Important Disclaimers</h2>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-foreground">No Voting Advice</h3>
            <p>
              Glas Politics provides <strong className="text-foreground">informational tools only</strong>. We do NOT tell you how to vote. Quiz results, party matches, and TD rankings are educational resources to help you explore your political views—not instructions or endorsements.
            </p>
          </div>
          <div>
            <h3 className="text-foreground">AI-Generated Content</h3>
            <p>
              Some content (news summaries, TD scores, policy impact analysis) is generated using artificial intelligence. While we strive for accuracy, AI may occasionally produce errors, biases, or incomplete information. <strong className="text-foreground">Always verify critical information from original sources.</strong>
            </p>
          </div>
          <div>
            <h3 className="text-foreground">Third-Party Content</h3>
            <p>
              News articles, TD voting records, and other political data come from external sources. We aggregate and analyze this data but do not control its accuracy. We are not responsible for errors in source material.
            </p>
          </div>
          <div>
            <h3 className="text-foreground">Not a Substitute for Research</h3>
            <p>
              Voting is a serious responsibility. Our platform is a starting point for political education, not a replacement for thorough research, reading party manifestos, or attending candidate debates.
            </p>
          </div>
        </div>
      </section>

      <section id="eligibility" className="scroll-mt-24">
        <h2 className="mb-4 flex items-center gap-2"><Shield className="h-6 w-6" aria-hidden="true" />User Eligibility</h2>
        <p className="mb-4">
          You must meet the following requirements to use Glas Politics:
        </p>
        <ul>
          <li>Be at least 18 years of age</li>
          <li>Provide accurate and truthful information when creating an account</li>
          <li>Not use the Platform for illegal or harmful purposes</li>
          <li>Comply with all applicable Irish and EU laws</li>
        </ul>
      </section>

      <section id="responsibilities" className="scroll-mt-24">
        <h2 className="mb-4">Your Account Responsibilities</h2>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-foreground">Account Security</h3>
            <ul>
              <li>You are responsible for maintaining the confidentiality of your account credentials</li>
              <li>You must notify us immediately of any unauthorized access</li>
              <li>You are liable for all activities under your account</li>
            </ul>
          </div>
          <div>
            <h3 className="text-foreground">Accurate Information</h3>
            <ul>
              <li>Do not create fake accounts or impersonate others</li>
              <li>Update your profile information if it changes</li>
              <li>Provide a valid email address for account recovery</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="prohibited" className="scroll-mt-24">
        <h2 className="mb-4 flex items-center gap-2"><XCircle className="h-6 w-6" aria-hidden="true" />Prohibited Activities</h2>
        <p className="mb-4">
          You agree NOT to:
        </p>
        <ul className="space-y-2">
          <li><strong className="text-foreground">Manipulate Data:</strong> Vote stuffing, bot accounts, or artificially inflating TD/party scores</li>
          <li><strong className="text-foreground">Abuse the Platform:</strong> Spamming, harassment, hate speech, or threatening behavior</li>
          <li><strong className="text-foreground">Violate Privacy:</strong> Doxxing, sharing others' personal information without consent</li>
          <li><strong className="text-foreground">Illegal Activity:</strong> Fraud, copyright infringement, or defamation</li>
          <li><strong className="text-foreground">Scraping/Automation:</strong> Unauthorized automated access, web scraping, or API abuse</li>
          <li><strong className="text-foreground">Reverse Engineering:</strong> Decompiling, disassembling, or hacking the Platform</li>
          <li><strong className="text-foreground">Misinformation:</strong> Deliberately spreading false political information</li>
          <li><strong className="text-foreground">Election Interference:</strong> Using the Platform for voter suppression or election fraud</li>
        </ul>
        <p className="mt-4 font-semibold text-foreground">
          Violation of these terms may result in account suspension or permanent ban, and we may report illegal activity to authorities.
        </p>
      </section>

      <section id="content" className="scroll-mt-24">
        <h2 className="mb-4">User-Generated Content</h2>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-foreground">Content You Submit</h3>
            <p>
              When you submit ideas, comments, or other content ("User Content"), you:
            </p>
            <ul>
              <li>Retain ownership of your content</li>
              <li>Grant us a non-exclusive, royalty-free, worldwide license to display, distribute, and analyze your content on the Platform</li>
              <li>Confirm you have the right to submit the content (not copyrighted by others)</li>
              <li>Agree your content does not violate Irish defamation law or any other laws</li>
            </ul>
          </div>
          <div>
            <h3 className="text-foreground">Content Moderation</h3>
            <p>
              We reserve the right (but not the obligation) to:
            </p>
            <ul>
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

      <section id="ip" className="scroll-mt-24">
        <h2 className="mb-4">Intellectual Property</h2>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-foreground">Our Content</h3>
            <p>
              All original content on Glas Politics (quiz questions, algorithms, design, branding, etc.) is owned by Glas Politics or licensed to us. You may not:
            </p>
            <ul>
              <li>Copy, modify, or redistribute our content without permission</li>
              <li>Use our trademarks or logos without authorization</li>
              <li>Claim our work as your own</li>
            </ul>
          </div>
          <div>
            <h3 className="text-foreground">Third-Party Content</h3>
            <p>
              News articles, TD photos, and other third-party content remain the property of their original creators. We display this content under fair use for news reporting and political commentary. If you believe we are infringing your copyright, contact us at <a href="mailto:legal@glaspolitics.ie">legal@glaspolitics.ie</a>.
            </p>
          </div>
        </div>
      </section>

      <section id="data" className="scroll-mt-24">
        <h2 className="mb-4">Data Usage &amp; Privacy</h2>
        <p>
          Your use of Glas Politics is subject to our <Link href="/privacy-policy" className="font-semibold">Privacy Policy</Link>. Key points:
        </p>
        <ul>
          <li>We collect political preference data to provide personalized recommendations</li>
          <li>Your quiz results are private by default (you can share them optionally)</li>
          <li>We never sell your data or share it with political campaigns</li>
          <li>You can delete your account and all data at any time</li>
        </ul>
      </section>

      <section id="warranties" className="scroll-mt-24 rounded-xl border border-destructive/40 bg-destructive/10 p-6">
        <h2 className="mb-4 flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />Disclaimer of Warranties</h2>
        <p className="mb-4 font-semibold uppercase text-foreground">
          IMPORTANT LEGAL NOTICE
        </p>
        <div className="flex flex-col gap-3">
          <p>
            <strong className="text-foreground">THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND.</strong>
          </p>
          <p>
            We do not guarantee:
          </p>
          <ul>
            <li>100% accuracy of political data, TD scores, or news analysis</li>
            <li>Uninterrupted or error-free service</li>
            <li>Complete security (though we implement industry-standard protections)</li>
            <li>That quiz results perfectly match your political views</li>
          </ul>
          <p>
            <strong className="text-foreground">USE AT YOUR OWN RISK.</strong> We are not liable for decisions you make based on information from our Platform.
          </p>
        </div>
      </section>

      <section id="liability" className="scroll-mt-24">
        <h2 className="mb-4 flex items-center gap-2"><Scale className="h-6 w-6" aria-hidden="true" />Limitation of Liability</h2>
        <p className="mb-4">
          <strong className="text-foreground">TO THE MAXIMUM EXTENT PERMITTED BY IRISH AND EU LAW:</strong>
        </p>
        <ul className="space-y-2">
          <li>Glas Politics, its founders, employees, and partners are <strong className="text-foreground">NOT LIABLE</strong> for any indirect, incidental, consequential, or punitive damages</li>
          <li>This includes loss of data, loss of profits, or reputational harm arising from your use of the Platform</li>
          <li>Our total liability to you for any claim shall not exceed €100 or the amount you paid us (whichever is greater)</li>
        </ul>
        <p className="mt-4 text-sm italic">
          Note: This limitation does not affect your statutory rights as a consumer under Irish/EU law (e.g., rights under GDPR, defective products, fraud).
        </p>
      </section>

      <section id="indemnification" className="scroll-mt-24">
        <h2 className="mb-4">Indemnification</h2>
        <p>
          You agree to indemnify (compensate) and hold Glas Politics harmless from any claims, losses, or expenses (including legal fees) arising from:
        </p>
        <ul>
          <li>Your violation of these Terms</li>
          <li>Your User Content (e.g., if someone sues us for defamation based on your post)</li>
          <li>Your misuse of the Platform</li>
        </ul>
      </section>

      <section id="changes" className="scroll-mt-24">
        <h2 className="mb-4">Changes to the Platform &amp; Terms</h2>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-foreground">Platform Changes</h3>
            <p>
              We may add, modify, or discontinue features at any time. We are not obligated to provide advance notice for non-material changes.
            </p>
          </div>
          <div>
            <h3 className="text-foreground">Terms Updates</h3>
            <p>
              We may update these Terms periodically. We will notify you of significant changes via email or in-app notification. Continued use after changes constitutes acceptance. If you disagree, please stop using the Platform.
            </p>
          </div>
        </div>
      </section>

      <section id="termination" className="scroll-mt-24">
        <h2 className="mb-4">Account Termination</h2>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-foreground">Your Right to Terminate</h3>
            <p>
              You may delete your account at any time through your <Link href="/profile">Profile Settings</Link>. Upon deletion:
            </p>
            <ul>
              <li>Your personal data will be permanently deleted within 30 days</li>
              <li>Anonymized analytics data may be retained</li>
              <li>Public content (ideas, comments) may remain visible but anonymized</li>
            </ul>
          </div>
          <div>
            <h3 className="text-foreground">Our Right to Terminate</h3>
            <p>
              We may suspend or terminate your account if you:
            </p>
            <ul>
              <li>Violate these Terms of Service</li>
              <li>Engage in illegal activity</li>
              <li>Threaten the security or integrity of the Platform</li>
              <li>Are inactive for more than 5 years</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="disputes" className="scroll-mt-24">
        <h2 className="mb-4 flex items-center gap-2"><Scale className="h-6 w-6" aria-hidden="true" />Dispute Resolution &amp; Governing Law</h2>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-foreground">Governing Law</h3>
            <p>
              These Terms are governed by the laws of <strong className="text-foreground">Ireland</strong> and the <strong className="text-foreground">European Union</strong>. Any disputes will be resolved in Irish courts.
            </p>
          </div>
          <div>
            <h3 className="text-foreground">Informal Resolution</h3>
            <p>
              Before filing a lawsuit, please contact us at <a href="mailto:legal@glaspolitics.ie">legal@glaspolitics.ie</a> to resolve the issue informally. Most disputes can be settled through good-faith negotiation.
            </p>
          </div>
          <div>
            <h3 className="text-foreground">EU Alternative Dispute Resolution</h3>
            <p>
              EU consumers may access the <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">European Commission's Online Dispute Resolution (ODR) platform</a> for resolving consumer disputes.
            </p>
          </div>
        </div>
      </section>

      <section id="misc" className="scroll-mt-24">
        <h2 className="mb-4">Miscellaneous</h2>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-foreground">Severability</h3>
            <p>
              If any provision of these Terms is found invalid, the remaining provisions remain in full effect.
            </p>
          </div>
          <div>
            <h3 className="text-foreground">No Waiver</h3>
            <p>
              Our failure to enforce any right or provision does not constitute a waiver of that right.
            </p>
          </div>
          <div>
            <h3 className="text-foreground">Assignment</h3>
            <p>
              You may not transfer your account or rights under these Terms. We may assign our rights to a successor entity (e.g., in a merger).
            </p>
          </div>
          <div>
            <h3 className="text-foreground">Entire Agreement</h3>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Glas Politics.
            </p>
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-24 rounded-xl bg-elevated p-6">
        <h2 className="mb-4 flex items-center gap-2"><FileText className="h-6 w-6" aria-hidden="true" />Questions About These Terms?</h2>
        <p className="mb-4">
          If you have questions or concerns about these Terms of Service:
        </p>
        <ul>
          <li>Email: <a href="mailto:legal@glaspolitics.ie">legal@glaspolitics.ie</a></li>
          <li>Contact Form: <Link href="/contact">glaspolitics.ie/contact</Link></li>
        </ul>
      </section>

      <section className="scroll-mt-24 rounded-xl border border-success/40 bg-success/10 p-6">
        <h2 className="mb-4 flex items-center gap-2"><CheckCircle className="h-6 w-6 text-success" aria-hidden="true" />By Using Glas Politics, You Agree</h2>
        <ul className="space-y-2">
          <li>You have read and understood these Terms</li>
          <li>You are at least 18 years old</li>
          <li>You will use the Platform responsibly and legally</li>
          <li>You understand our disclaimers and limitations of liability</li>
          <li>You agree to resolve disputes under Irish/EU law</li>
        </ul>
      </section>
    </LegalLayout>
  );
}
