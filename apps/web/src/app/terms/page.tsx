export default function TermsPage() {
  return (
    <div className="container">
      <h1>Terms of Service</h1>
      <p className="muted">Last updated: July 29, 2026.</p>

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
      <p>
        You can cancel your subscription at any time from the dashboard (Manage billing). When
        you cancel, your plan remains active through the end of the current billing period —
        access doesn&apos;t stop immediately, and you won&apos;t be billed again after that period
        ends.
      </p>
      <p>
        We don&apos;t provide partial refunds for unused time within a billing period. If a
        payment is charged in error, or you believe you have another legitimate reason for a
        refund, contact <a href="mailto:support@werida.io">support@werida.io</a> — we review these
        case by case and may issue a refund at our discretion.
      </p>
      <p>
        If a renewal payment fails, we&apos;ll retry it automatically over the following days.
        Credits you&apos;ve already been given still work during that time, but you won&apos;t
        receive a new batch until the payment succeeds. If it&apos;s never resolved, your account
        moves back to the Free plan.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@werida.io">support@werida.io</a>
      </p>
    </div>
  );
}
