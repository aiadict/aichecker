import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support — AI Checker",
  description: "Get help with AI Checker: how to use it, common questions, and how to reach us.",
};

export default function SupportPage() {
  return (
    <div className="container" style={{ paddingBottom: 64 }}>
      <h1>Support</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Questions, bug reports, billing issues, anything — this page covers the common ones, and
        below that is how to reach a real person.
      </p>

      <nav className="support-jumpnav" aria-label="Jump to a question">
        <a href="#percentage">Percentage</a>
        <a href="#word-minimum">Word minimum</a>
        <a href="#credits">Credits</a>
        <a href="#pinning">Pinning</a>
        <a href="#privacy">Privacy</a>
        <a href="#delete-account">Deleting data</a>
        <a href="#billing">Billing</a>
        <a href="#floating-icon">Floating icon</a>
        <a href="#extension-signin">Extension sign-in</a>
      </nav>

      <div className="card">
        <h3>Get in touch</h3>
        <p>
          Email <a href="mailto:support@werida.io">support@werida.io</a> and we&apos;ll get back
          to you. That&apos;s the fastest way to reach us right now - include what you were doing
          when something went wrong if you can, it helps a lot.
        </p>
      </div>

      <div className="card">
        <h3>Getting started</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          Three ways to check a piece of text, all leading to the same place:
        </p>
        <ol style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Select text on any page, then click the small circular icon that appears next to it.</li>
          <li>Select text, right-click, and choose &quot;Check for AI Content.&quot;</li>
          <li>Open AI Checker from your toolbar and paste text directly into the box.</li>
        </ol>
        <p className="muted" style={{ marginTop: 12 }}>
          All three open AI Checker with your text ready to go — you still click{" "}
          <strong>Check for AI</strong> yourself, so nothing gets sent off without you seeing it
          first. A longer walkthrough with screenshots is at{" "}
          <Link href="/welcome">the welcome page</Link>.
        </p>
      </div>

      <h2 style={{ marginTop: 40 }}>Common questions</h2>

      <div className="card" id="percentage">
        <h3>What does the percentage mean?</h3>
        <p>
          It&apos;s how much of the text our detection model believes shows signs of AI
          involvement, split into AI-generated, AI-assisted, and human-written. It&apos;s a strong
          signal, not a certainty — treat it as one input among several, especially for anything
          with real consequences for someone (grading, hiring, and so on).
        </p>
      </div>

      <div className="card" id="word-minimum">
        <h3>How much text do I need to paste?</h3>
        <p>
          At least 50 words. Shorter than that, the result isn&apos;t reliable enough to be worth
          showing you — you&apos;ll see a reminder in the extension if you&apos;re under the
          minimum.
        </p>
      </div>

      <div className="card" id="credits">
        <h3>What&apos;s a credit, and how many do I get?</h3>
        <p>
          1 credit covers roughly 1,000 words. The Free plan includes 10 credits a month (capped
          at 4 checks a day); Pro and Business include more. See{" "}
          <Link href="/pricing">pricing</Link> for the full breakdown, or check your remaining
          balance any time at the top of the extension.
        </p>
      </div>

      <div className="card" id="pinning">
        <h3>How do I pin AI Checker to my toolbar?</h3>
        <p>
          Open AI Checker (click its toolbar icon, or select text and use the floating icon or
          right-click menu) — then click the pin icon at the top of the panel. That&apos;s
          Chrome&apos;s own control, not something we built, so it works the same way any pinned
          extension does.
        </p>
      </div>

      <div className="card" id="privacy">
        <h3>Is my text stored, or shared with anyone?</h3>
        <p>
          Your checked text is stored in your account (so your history means something), and sent
          to Pangram, the detection service we use under the hood, solely to run the check — not
          to train any model. It&apos;s never sold or used for anything else. Full details at{" "}
          <Link href="/privacy">privacy</Link>.
        </p>
      </div>

      <div className="card" id="delete-account">
        <h3>How do I delete a check, or my whole account?</h3>
        <p>
          Open any past check from your <Link href="/dashboard/history">history</Link> and delete
          it from there. To delete everything — your account, history, and billing link in one
          go — visit <Link href="/dashboard/account">Account Settings</Link>. You can also export
          your data first if you want a copy.
        </p>
      </div>

      <div className="card" id="billing">
        <h3>How do I upgrade, downgrade, or cancel?</h3>
        <p>
          Upgrade from <Link href="/pricing">pricing</Link>. To change or cancel a paid plan, go
          to your <Link href="/dashboard">dashboard</Link> and click &quot;Manage billing&quot; —
          that takes you to Stripe&apos;s own billing portal. Cancelling keeps your plan and
          credits until the end of the period you&apos;ve already paid for.
        </p>
      </div>

      <div className="card" id="floating-icon">
        <h3>The floating icon or right-click menu isn&apos;t showing up</h3>
        <p>
          Most often this means the extension needs a reload: go to{" "}
          <code>chrome://extensions</code>, find AI Checker, and click the refresh icon — then
          refresh the page you&apos;re trying to use it on too. If it was just installed or
          updated, a full page refresh is usually all it needs.
        </p>
      </div>

      <div className="card" id="extension-signin">
        <h3>I&apos;m signed in on werida.io but the extension says I&apos;m not</h3>
        <p>
          The extension keeps its own sign-in, separate from your browser session on this site —
          sign in from AI Checker&apos;s Settings tab directly. If you were signed in on the
          extension before and it suddenly says otherwise, try signing in again there; if it
          keeps happening, email us.
        </p>
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <h3>Still stuck?</h3>
        <p style={{ marginBottom: 0 }}>
          Email <a href="mailto:support@werida.io">support@werida.io</a> - a human reads
          every message.
        </p>
      </div>
    </div>
  );
}
