import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Welcome — AI Checker",
  description: "You're all set — pin AI Checker and start checking text for AI in seconds.",
};

export default function WelcomePage() {
  return (
    <div className="container welcome-page">
      <div className="welcome-hero">
        <h1>AI Checker is installed 🎉</h1>
        <p className="muted">Three quick steps and you&apos;re ready to check any text for AI.</p>
      </div>

      <div className="welcome-step">
        <div className="welcome-step-text">
          <span className="step-num">1</span>
          <h3>Pin AI Checker to your toolbar</h3>
          <p className="muted">
            Click the puzzle-piece icon in Chrome&apos;s toolbar, then click the pin next to AI
            Checker so it&apos;s always one click away.
          </p>
        </div>
        <img
          className="welcome-step-img"
          src="/welcome/pin-1.png"
          alt="Click the puzzle-piece icon in Chrome's toolbar, then click the pin next to AI Checker"
        />
      </div>

      <div className="welcome-step welcome-step-reverse">
        <div className="welcome-step-text">
          <span className="step-num">2</span>
          <h3>Open AI Checker anytime</h3>
          <p className="muted">
            Once it&apos;s pinned, click the AI Checker icon in your toolbar to open it from any
            page.
          </p>
        </div>
        <img
          className="welcome-step-img"
          src="/welcome/open-2.png"
          alt="Click the pinned AI Checker icon in Chrome's toolbar to open it"
        />
      </div>

      <div className="welcome-step-full">
        <span className="step-num">3</span>
        <h3>Check your first text</h3>
        <p className="muted">
          Select text on any page and click the floating icon that appears, or right-click and
          choose &quot;Check for AI Content.&quot; Either way, AI Checker opens with your text
          ready — just click Check for AI.
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
