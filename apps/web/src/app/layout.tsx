import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Checker — know instantly what's human or AI",
  description:
    "AI Checker detects AI-generated text anywhere on the web, powered by the Pangram AI detection API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <nav className="site-nav">
            <Link href="/" className="brand">
              AI Checker
            </Link>
            <div>
              <Link href="/pricing" style={{ marginRight: 16 }}>
                Pricing
              </Link>
              <Link href="/dashboard">Dashboard</Link>
            </div>
          </nav>
        </div>
        {children}
        <div className="container">
          <footer className="site-footer">
            <Link href="/privacy" style={{ marginRight: 16 }}>
              Privacy Policy
            </Link>
            <Link href="/terms">Terms of Service</Link>
            <p>© {new Date().getFullYear()} AI Checker. Detection powered by the Pangram API.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
