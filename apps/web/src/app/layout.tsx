import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import SiteNav from "./components/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Checker — know instantly what's human or AI",
  description:
    "AI Checker detects AI-generated text anywhere on the web, powered by the Pangram AI detection API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.className}>
      {/* Browser extensions (Grammarly, LastPass, etc.) inject attributes
          like data-gr-ext-installed into <body> before React hydrates,
          which React otherwise flags as a hydration mismatch. Harmless —
          suppressHydrationWarning only ignores attribute diffs on this one
          node, not hydration errors generally. */}
      <body suppressHydrationWarning>
        <div className="container">
          <SiteNav />
        </div>
        {children}
        <div className="container">
          <footer className="site-footer">
            <div className="site-footer-links">
              <Link href="/support">Support</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
            </div>
            <p>© {new Date().getFullYear()} AI Checker.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
