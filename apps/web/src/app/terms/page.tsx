export default function TermsPage() {
  return (
    <div className="container">
      <h1>Terms of Service</h1>
      <p className="muted">
        Draft placeholder — have this reviewed by counsel before publishing. Last updated: TODO.
      </p>

      <h2>The service</h2>
      <p>
        AI Checker provides an AI-text-detection result based on third-party analysis (the
        Pangram API). Results are probabilistic, not a certainty, and should not be the sole
        basis for any disciplinary, academic, or legal decision.
      </p>

      <h2>Plans &amp; credits</h2>
      <p>
        Each plan includes a monthly credit allotment (1 credit ≈ 1,000 words checked). Credits
        reset each billing period and do not roll over unless stated otherwise on the pricing
        page. We may adjust plan limits and pricing with notice.
      </p>

      <h2>Acceptable use</h2>
      <p>
        No automated scripting of the free plan to bypass limits, no reselling API access, no
        submitting content you don&apos;t have the right to submit.
      </p>

      <h2>Cancellation &amp; refunds</h2>
      <p>Cancel anytime from Account Settings. Refund policy: TODO.</p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@werida.io">support@werida.io</a>
      </p>
    </div>
  );
}
