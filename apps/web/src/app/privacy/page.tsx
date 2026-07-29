export default function PrivacyPage() {
  return (
    <div className="container">
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: July 29, 2026</p>

      <p>
        AI Checker is built by a small team, and we&apos;d rather keep this policy readable than
        pad it out with boilerplate. Here&apos;s the short version up front: we don&apos;t sell
        your data, we don&apos;t use the text you submit to train any AI model, and we delete your
        content when you ask us to. The rest of this page explains the details.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account info.</strong> Your email address, and your name or avatar if you sign
          in with Google.
        </li>
        <li>
          <strong>The text you check.</strong> When you run a check, that text is sent to Pangram
          Labs, the detection provider we use, purely to generate a result. If you keep the check
          in your history, we store it too, so you can look back at it later.
        </li>
        <li>
          <strong>Usage details.</strong> Things like which page or site a check came from, when
          it happened, and how many credits it used.
        </li>
        <li>
          <strong>Billing information.</strong> Payments run through Stripe. We see things like
          your plan and payment status, but we never see or store your full card number.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Basically, to run the service: generating detection results, keeping track of your
        credits and history, and helping you if you write in with a support question. We don&apos;t
        use anything you submit to train or improve any AI model, ours or anyone else&apos;s, and
        neither does Pangram, under their own policy. We don&apos;t sell your data to advertisers
        or data brokers, and we don&apos;t use your checked text for marketing.
      </p>

      <h2>A few quick answers</h2>
      <p>
        <strong>Do you train AI models on my text?</strong> No. It only goes to Pangram to get a
        detection score back, and it isn&apos;t used to train anything.
      </p>
      <p>
        <strong>Can I delete my history?</strong> Yes, from the History tab in the extension or
        the dashboard, whenever you like.
      </p>
      <p>
        <strong>What happens if I close my account?</strong> Your checks, history, and any other
        content tied to your account are permanently deleted within 30 days. Billing records are
        kept a bit longer, since we&apos;re required to for accounting and tax purposes.
      </p>

      <h2>Cookies and sessions</h2>
      <p>
        The website uses a cookie to keep you signed in between visits. That&apos;s it, we&apos;re
        not running ad trackers or cross-site pixels on werida.io. The extension stores your
        session locally in your browser so it knows you&apos;re logged in.
      </p>

      <h2>Who we share data with</h2>
      <p>
        We work with a small number of vendors to run AI Checker, and they only get what they need
        to do their job:
      </p>
      <ul>
        <li>Pangram Labs, for the actual AI/human detection.</li>
        <li>Supabase, for our database and sign-in.</li>
        <li>Stripe, for billing and payments.</li>
        <li>Vercel, for hosting the website.</li>
      </ul>
      <p>
        We don&apos;t share your data with anyone else, and we don&apos;t sell it, full stop.
      </p>

      <h2>Where data is stored</h2>
      <p>
        Our infrastructure runs on servers that may be located outside your own country. By using
        AI Checker, you&apos;re okay with your data being processed there, under the protections
        described in this policy.
      </p>

      <h2>Your rights</h2>
      <p>
        You can see, export, or delete most of your data straight from Account Settings. For
        anything else, like a full data export or a question about what we hold on you, email{" "}
        <a href="mailto:support@werida.io">support@werida.io</a> and we&apos;ll get back to you.
        If you&apos;re in California or another state with its own privacy law, you have the same
        rights under that law too, and we&apos;ll honor them the same way.
      </p>

      <h2>Children&apos;s privacy</h2>
      <p>
        AI Checker isn&apos;t directed at children, and we ask that you be at least 16 to create
        an account (see our <a href="/terms">Terms of Service</a>). We don&apos;t knowingly
        collect data from anyone younger than that.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we make a meaningful change to how we handle your data, we&apos;ll update this page and
        change the date at the top. For anything major, we&apos;ll try to let you know directly,
        by email or inside the product.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, requests, or concerns about your data can go to{" "}
        <a href="mailto:support@werida.io">support@werida.io</a> any time.
      </p>
    </div>
  );
}
