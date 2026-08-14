import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Welcome - AI Checker",
  description: "You're all set - here's how to check your first piece of text for AI.",
};

export default function WelcomePage() {
  return (
    <div className="container welcome-page">
      <div className="welcome-hero">
        <h1>AI Checker is installed</h1>
        <p className="muted">Here&apos;s how to check your first piece of text.</p>
      </div>

      <div className="welcome-step-full">
        <h3>Check your first text</h3>
        <p className="muted">
          Select text on any page and click the floating icon that appears, or right-click and
          choose &quot;Check for AI Content.&quot; Either way, AI Checker opens with your text
          ready - just click Check for AI.
        </p>
        <img
          className="welcome-step-img-full"
          src="/welcome/usage-3.png"
          alt="Select text, click the floating AI Checker icon or use the right-click menu, then click Check for AI"
        />
      </div>

      <div className="welcome-cta">
        <Link className="cta-button" href="/dashboard">
          Go to your dashboard
        </Link>
      </div>
    </div>
  );
}
