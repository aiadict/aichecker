export default function HomePage() {
  return (
    <div className="container">
      <section className="hero">
        <h1>
          Know instantly what&apos;s <em>human</em> or <em>AI</em>.
        </h1>
        <p>
          AI Checker highlights AI-generated text anywhere on the web — paste it, select it, or
          right-click it. Powered by the Pangram AI detection API.
        </p>
        <a className="cta-button" href="https://chromewebstore.google.com" target="_blank" rel="noreferrer">
          Add to Chrome — it&apos;s free
        </a>
      </section>

      <section style={{ paddingBottom: 40 }}>
        <img
          className="welcome-step-img-full"
          src="/welcome/usage-3.png"
          alt="Select text, click the floating AI Checker icon or use the right-click menu, then click Check for AI"
        />
      </section>

      <section>
        <div className="card">
          <h3>Check anywhere</h3>
          <p className="muted">
            Highlight text on any page, right-click, and choose &quot;Check for AI Content&quot; — or
            click the floating icon that appears next to your selection.
          </p>
        </div>
        <div className="card">
          <h3>Understand the result</h3>
          <p className="muted">
            See a clear Human / AI / Mixed verdict with a confidence breakdown, and share a
            private result link when you need to show your work.
          </p>
        </div>
        <div className="card">
          <h3>Built for real usage limits</h3>
          <p className="muted">
            Free plan includes 10 checks a month. Upgrade to Pro or Business for more credits —
            see <a href="/pricing">pricing</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
