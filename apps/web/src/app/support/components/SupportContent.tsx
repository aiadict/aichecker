"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LogoBadge, PinIcon, PuzzlePieceIcon } from "../../components/ChromeIcons";

type Topic = "extension" | "results" | "plans" | "account";
type TopicFilter = "all" | Topic;

interface Faq {
  id: string;
  topic: Topic;
  keywords: string;
  question: string;
  answer: React.ReactNode;
}

const TOPIC_LABELS: Record<TopicFilter, string> = {
  all: "All topics",
  extension: "Extension",
  results: "Results",
  plans: "Plans & credits",
  account: "Account & privacy",
};

const TOPIC_HEADINGS: Record<TopicFilter, string> = {
  all: "Common questions",
  extension: "Using the extension",
  results: "Understanding your results",
  plans: "Plans & credits",
  account: "Account & privacy",
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function SupportContent() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<TopicFilter>("all");
  // Persists only manual open/close clicks - search never writes here, so
  // clearing the search box restores exactly what the user had open
  // before they started typing (matches the reference mockup's behavior).
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({ signin: true });
  const detailsRefs = useRef<Record<string, HTMLDetailsElement | null>>({});

  const faqs: Faq[] = useMemo(
    () => [
      {
        id: "signin",
        topic: "extension",
        keywords:
          "login log in sign up signup register registration confirm confirmation email not logged in sync synchronise synchronize",
        question: "I’m signed in on the website. Why isn’t the extension?",
        answer: (
          <>
            <p>
              Open the AI Checker extension. If you see <strong>&quot;Sign in&quot;</strong>, click it to
              finish signing in there too.
            </p>
            <p>
              Use the same email as your website account. You can also sign in from the extension&apos;s{" "}
              <strong>Settings</strong> tab.
            </p>
            <button
              type="button"
              className="support-inline-link"
              onClick={() => jumpTo("find-extension")}
            >
              Where do I find the extension?
              <ArrowIcon />
            </button>
            <p className="support-answer-note muted">
              If it keeps asking you to sign in again,{" "}
              <a href="mailto:support@werida.io?subject=AI%20Checker%20sign-in%20help">email us</a>.
            </p>
          </>
        ),
      },
      {
        id: "find-extension",
        topic: "extension",
        keywords: "pin pinning pinned puzzle piece toolbar chrome icon open find",
        question: "How do I find and pin AI Checker in Chrome?",
        answer: (
          <>
            <ol className="support-steps">
              <li>
                Click the <strong>puzzle-piece icon</strong> <PuzzlePieceIcon /> in the top-right corner of
                Chrome, next to the address bar.
              </li>
              <li>
                Select <strong>AI Checker</strong> from the menu.
              </li>
              <li>
                Once the AI Checker panel opens, click the <strong>pin icon</strong> at the top of the
                panel to keep it in your toolbar.
              </li>
            </ol>
            <div className="ext-help-mock support-mock" aria-hidden="true">
              <div className="ext-help-mock-toolbar">
                <span className="ext-help-mock-addressbar">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />
                  </svg>
                  Address bar
                </span>
                <span className="ext-help-mock-btn ext-help-mock-puzzle">
                  <PuzzlePieceIcon size={15} />
                </span>
              </div>
              <div className="ext-help-mock-dropdown">
                <div className="ext-help-mock-dropdown-header">Extensions</div>
                <div className="ext-help-mock-dropdown-row">
                  <span className="ext-help-mock-ext-icon">
                    <LogoBadge size={18} />
                  </span>
                  <span className="ext-help-mock-ext-name">AI Checker</span>
                  <PinIcon size={13} />
                </div>
              </div>
            </div>
          </>
        ),
      },
      {
        id: "getting-started",
        topic: "extension",
        keywords:
          "start check checking text paste upload select highlight floating icon right click content first use welcome autorun automatic",
        question: "How do I check a piece of text?",
        answer: (
          <>
            <p>Choose whichever way is easiest:</p>
            <ul className="support-list">
              <li>
                <strong>Select text on a webpage</strong> and click the small circular AI Checker icon
                that appears — this checks it right away, no extra click needed.
              </li>
              <li>
                <strong>Select text and right-click</strong>, then choose &quot;Check for AI
                Content.&quot; — this also checks it immediately.
              </li>
              <li>
                <strong>Open AI Checker from your toolbar</strong> and paste or type text into the box,
                or upload a file (.pdf, .doc, .docx, or .txt). You can edit the text first, then click{" "}
                <strong>Check for AI</strong> when you&apos;re ready.
              </li>
            </ul>
            <p>
              Only the paste/upload option waits for a button click — nothing is sent until you
              press it. The icon and right-click options run the check as soon as you choose them,
              since you&apos;ve already picked the text you want checked.
            </p>
            <Link href="/check" className="support-inline-link">
              Check text on the website
              <ArrowIcon />
            </Link>
          </>
        ),
      },
      {
        id: "score",
        topic: "results",
        keywords:
          "percentage percentages highlights highlighting meaning accuracy accurate score ai generated assisted human written interpretation detection certainty",
        question: "What does your AI score mean?",
        answer: (
          <>
            <p>
              Your score estimates how much of your text reads as AI-generated. Learn what the
              percentages mean and how to interpret your results.
            </p>
            <p>
              Results are split into <strong>AI-generated</strong>, <strong>AI-assisted</strong>, and{" "}
              <strong>human-written</strong>. These are estimates, not proof of how a text was written.
              Consider them alongside other information, especially for decisions such as grading or
              hiring.
            </p>
            <Link href="/resultsupport" className="support-inline-link">
              Read the results guide
              <ArrowIcon />
            </Link>
          </>
        ),
      },
      {
        id: "word-minimum",
        topic: "results",
        keywords: "word words minimum min limit length short small text 50 paste",
        question: "How much text do I need to check?",
        answer: (
          <p>
            You need at least <strong>50 words</strong>. Shorter text does not provide enough
            information for a reliable result. The extension will show a reminder if your text is
            below the minimum.
          </p>
        ),
      },
      {
        id: "credits",
        topic: "plans",
        keywords:
          "credit credits costs cost free monthly daily balance quota words allowance 1000 checks pricing",
        question: "How do credits work?",
        answer: (
          <>
            <p>
              <strong>1 credit covers roughly 1,000 words.</strong> The Free plan includes{" "}
              <strong>25 credits a month</strong>. Paid plans include more credits.
            </p>
            <p>
              See <Link href="/pricing">Pricing</Link> for the full breakdown. You can find your
              remaining credits at the top of the extension or on your <Link href="/dashboard">Dashboard</Link>.
            </p>
          </>
        ),
      },
      {
        id: "billing",
        topic: "plans",
        keywords:
          "subscription upgrade downgrade cancel cancellation billing manage stripe payment paid renewal plan pricing",
        question: "How do I upgrade, change, or cancel my plan?",
        answer: (
          <>
            <p>
              To upgrade, visit <Link href="/pricing">Pricing</Link>.
            </p>
            <p>
              To change or cancel a paid plan, open your <Link href="/dashboard">Dashboard</Link> and
              select <strong>Manage billing</strong>. This opens Stripe&apos;s billing portal.
            </p>
            <p>If you cancel, you keep your plan and credits until the end of the period you have already paid for.</p>
          </>
        ),
      },
      {
        id: "missing-icon",
        topic: "extension",
        keywords:
          "missing broken not working bug error floating icon circle right click menu showing visible reload refresh update installed troubleshoot",
        question: "The floating icon or right-click option is missing. What can I do?",
        answer: (
          <>
            <p>
              <strong>First, refresh the webpage.</strong> This is often all you need after installing
              or updating the extension.
            </p>
            <p>If that does not help:</p>
            <ol className="support-steps">
              <li>
                Type <code>chrome://extensions</code> in Chrome&apos;s address bar.
              </li>
              <li>
                Find <strong>AI Checker</strong> and click its refresh icon.
              </li>
              <li>Refresh the webpage again, then try selecting your text.</li>
            </ol>
            <p>
              Still not working?{" "}
              <a href="mailto:support@werida.io?subject=AI%20Checker%20extension%20help">Email support</a>{" "}
              and tell us what happened.
            </p>
          </>
        ),
      },
      {
        id: "privacy",
        topic: "account",
        keywords:
          "privacy private data security stored storage shared sharing sell sold training train model provider history",
        question: "Is my text stored or shared with anyone?",
        answer: (
          <>
            <p>
              Your checked text is stored in your account so you can revisit it in your history. It is
              also sent to our AI-detection provider to run the check.
            </p>
            <p>
              Your text is not used to train models, sold, or used for other purposes. For full
              details, read our <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </>
        ),
      },
      {
        id: "delete-data",
        topic: "account",
        keywords:
          "export download json delete deleting remove account data history check close erase permanently settings billing",
        question: "How do I export my data or delete a check or account?",
        answer: (
          <>
            <ul className="support-list">
              <li>
                <strong>Export your data:</strong> go to <Link href="/dashboard/account">Account settings</Link>{" "}
                and select <strong>Export my data</strong>. You will get a JSON file with your checked
                text, results, and timestamps.
              </li>
              <li>
                <strong>Delete a check:</strong> open it from your <Link href="/dashboard/history">History</Link>{" "}
                and delete it there.
              </li>
              <li>
                <strong>Delete your account:</strong> go to <Link href="/dashboard/account">Account settings</Link>{" "}
                and select <strong>Delete my account</strong>.
              </li>
            </ul>
            <p>
              Account deletion permanently removes your account, history, remaining credits, settings,
              and billing link. It cannot be undone. Registering again with the same email starts at{" "}
              <strong>0 credits</strong>.
            </p>
            <p>
              <strong>Have a paid plan?</strong> Cancel it through <strong>Manage billing</strong> on your
              Dashboard before deleting your account. Export your data first if you want to keep a copy.
            </p>
          </>
        ),
      },
      {
        id: "signout",
        topic: "account",
        keywords: "log out logout sign out signout account settings session website",
        question: "How do I sign out of the website?",
        answer: (
          <p>
            Open <Link href="/dashboard/account">Account settings</Link> and click <strong>Sign out</strong>{" "}
            beside your account details.
          </p>
        ),
      },
    ],
    []
  );

  const faqIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const faq of faqs) {
      map.set(faq.id, normalize(`${faq.question} ${faq.keywords}`));
    }
    return map;
  }, [faqs]);

  const words = useMemo(() => {
    const normalized = normalize(query);
    return normalized ? normalized.split(/\s+/) : [];
  }, [query]);
  const isSearching = words.length > 0;

  const visible = useMemo(() => {
    const result: Record<string, boolean> = {};
    for (const faq of faqs) {
      const inTopic = topic === "all" || faq.topic === topic;
      const text = faqIndex.get(faq.id) ?? "";
      result[faq.id] = inTopic && words.every((w) => text.includes(w));
    }
    return result;
  }, [faqs, faqIndex, topic, words]);

  const count = Object.values(visible).filter(Boolean).length;

  function jumpTo(id: string) {
    setQuery("");
    setTopic("all");
    setOpenMap((m) => ({ ...m, [id]: true }));
    // Wait a tick for the (now-visible) item to render before scrolling.
    requestAnimationFrame(() => {
      const el = detailsRefs.current[id];
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
      el?.querySelector("summary")?.focus({ preventScroll: true });
    });
  }

  function resetAll() {
    setQuery("");
    setTopic("all");
  }

  const heading = isSearching ? "Search results" : TOPIC_HEADINGS[topic];
  const countLabel = isSearching
    ? `${count} ${count === 1 ? "match" : "matches"}`
    : `${count} ${count === 1 ? "answer" : "answers"}`;

  return (
    <div className="support-layout">
      <section className="support-help" aria-label="Help articles">
        <div className="support-search-shell">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m21 21-4.34-4.34" strokeLinecap="round" />
            <circle cx="11" cy="11" r="8" />
          </svg>
          <label className="support-sr-only" htmlFor="support-search">
            Search help
          </label>
          <input
            id="support-search"
            type="search"
            placeholder="Search help, e.g. sign in or credits"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="support-search-clear"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="support-topics" role="group" aria-label="Filter help by topic">
          {(Object.keys(TOPIC_LABELS) as TopicFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              className="support-topic"
              aria-pressed={topic === key}
              onClick={() => setTopic(key)}
            >
              {TOPIC_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="support-section-heading">
          <h2>{heading}</h2>
          <span role="status" aria-live="polite">
            {countLabel}
          </span>
        </div>

        {count > 0 ? (
          <div className="support-questions">
            {faqs
              .filter((faq) => visible[faq.id])
              .map((faq) => {
                const open = isSearching ? true : Boolean(openMap[faq.id]);
                return (
                  <details
                    key={faq.id}
                    className="support-question"
                    open={open}
                    ref={(el) => {
                      detailsRefs.current[faq.id] = el;
                    }}
                    onToggle={(e) => {
                      if (!isSearching) {
                        const el = e.currentTarget;
                        setOpenMap((m) => ({ ...m, [faq.id]: el.open }));
                      }
                    }}
                  >
                    <summary>
                      <span>{faq.question}</span>
                      <svg className="support-chevron" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <div className="support-answer">{faq.answer}</div>
                  </details>
                );
              })}
          </div>
        ) : (
          <div className="support-empty">
            <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m21 21-4.34-4.34" strokeLinecap="round" />
              <circle cx="11" cy="11" r="8" />
            </svg>
            <h3>No answers found</h3>
            <p className="muted">
              {query.trim()
                ? `No answers match "${query.trim()}"${topic !== "all" ? " in this topic." : "."} Try a different search or browse all topics.`
                : "Try a different topic or browse all questions."}
            </p>
            <button type="button" className="account-btn account-btn-outline" onClick={resetAll}>
              Show all questions
            </button>
            <p className="muted" style={{ marginTop: 14 }}>
              Or <a href="mailto:support@werida.io?subject=AI%20Checker%20support">email support</a> and
              we&apos;ll help.
            </p>
          </div>
        )}

        <div className="card" style={{ marginTop: 20 }}>
          <h3>Still stuck?</h3>
          <p style={{ marginBottom: 0 }}>
            Email <a href="mailto:support@werida.io">support@werida.io</a> - a human reads every
            message.
          </p>
        </div>
      </section>

      <aside className="support-sidebar" aria-label="Contact support and useful links">
        <section className="support-contact">
          <span className="support-contact-icon">
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="2" y="4" width="20" height="16" rx="2" />
            </svg>
          </span>
          <h2>Need a hand?</h2>
          <p>
            Questions, bugs, or billing issues?
            <br />
            We&apos;re here to help.
          </p>
          <a className="cta-button support-email-button" href="mailto:support@werida.io?subject=AI%20Checker%20support">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="2" y="4" width="20" height="16" rx="2" />
            </svg>
            Email support
          </a>
          <a className="support-email-address" href="mailto:support@werida.io">
            support@werida.io
          </a>
          <div className="support-contact-tip">
            <strong>Help us help you</strong>
            <p className="muted">Tell us what happened and what you were trying to do. A screenshot helps, too.</p>
          </div>
        </section>

        <section className="support-quicklinks">
          <h2>Useful links</h2>
          <Link href="/check" className="support-quicklink">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
              <path d="M14 2v5a1 1 0 0 0 1 1h5" />
            </svg>
            <span>Check text for AI</span>
            <ArrowIcon />
          </Link>
          <Link href="/dashboard" className="support-quicklink">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
            <span>Manage billing</span>
            <ArrowIcon />
          </Link>
          <Link href="/dashboard/account" className="support-quicklink">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.3-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Account settings</span>
            <ArrowIcon />
          </Link>
        </section>
      </aside>
    </div>
  );
}
