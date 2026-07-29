export default function PrivacyPage() {
  return (
    <div className="container">
      <h1>Privacy Policy</h1>
      <p className="muted">
        Draft placeholder — required before Chrome Web Store submission and Google OAuth
        verification. Have this reviewed by counsel before publishing. Last updated: TODO.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account info: email address, and name/avatar if you sign in with Google.</li>
        <li>
          Text you submit for checking. This is sent to our sub-processor, Pangram Labs
          (pangram.com), solely to generate the AI/human detection result.
        </li>
        <li>Usage data: which page a check was run from (source URL), timestamps, credits used.</li>
        <li>Payment data, handled by Stripe — we never see or store full card numbers.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To provide the detection service, enforce plan limits, and support your account. We do
        not sell your data. We do not use submitted text to train any AI model, and neither does
        Pangram, per their own policy commitments.
      </p>

      <h2>Retention</h2>
      <p>
        Check history is retained until you delete it or close your account. Deleting your
        account permanently removes your check history within 30 days.
      </p>

      <h2>Third parties</h2>
      <p>Pangram Labs (detection), Supabase (database/auth), Stripe (payments), Vercel (hosting).</p>

      <h2>Your rights</h2>
      <p>
        You can access, export, or delete your data from Account Settings, or by contacting{" "}
        <a href="mailto:support@werida.io">support@werida.io</a>.
      </p>
    </div>
  );
}
