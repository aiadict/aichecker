import type { Metadata } from "next";
import SupportContent from "./components/SupportContent";

export const metadata: Metadata = {
  title: "Support - AI Checker",
  description: "Get help with AI Checker: how to use it, common questions, and how to reach us.",
};

export default function SupportPage() {
  return (
    <div className="container" style={{ paddingBottom: 64 }}>
      <h1>Support</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Find an answer, solve a problem, or get in touch.
      </p>

      <SupportContent />
    </div>
  );
}
