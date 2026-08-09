"use client";

import { useState } from "react";
import Link from "next/link";

// Below ~640px there isn't room for the wordmark plus three nav links on
// one line — the wordmark used to wrap onto two lines ("AI" / "Checker")
// while the links got squeezed. Standard fix: collapse the links behind a
// hamburger toggle on narrow viewports, keep the wordmark on one line
// always. See globals.css's @media (max-width: 640px) block for the CSS
// half of this.
export default function SiteNav() {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <nav className="site-nav">
      <Link href="/" className="brand" onClick={close}>
        <img src="/logo.svg" width={22} height={22} alt="" />
        AI Checker
      </Link>

      <button
        type="button"
        className="nav-hamburger"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <div className={`site-nav-links${open ? " open" : ""}`}>
        <Link href="/pricing" onClick={close}>
          Pricing
        </Link>
        <Link href="/dashboard" onClick={close}>
          Dashboard
        </Link>
        <Link href="/support" onClick={close}>
          Support
        </Link>
      </div>
    </nav>
  );
}
