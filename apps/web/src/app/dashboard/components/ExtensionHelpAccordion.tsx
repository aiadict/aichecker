import { LogoBadge, PinIcon, PuzzlePieceIcon } from "../../components/ChromeIcons";

// Native <details>/<summary> - no JS needed, same CSS-only toggle pattern
// as /resultsupport's FAQ accordion. Replaces the old permanent one-line
// "you're logged in here" nudge with an actually-actionable explainer:
// most people asking "why isn't the extension signed in" don't know
// where the extension even lives in Chrome's UI.
export default function ExtensionHelpAccordion() {
  return (
    <details className="ext-help">
      <summary className="ext-help-summary">
        <span className="ext-help-icon" aria-hidden="true">
          <PuzzlePieceIcon size={18} />
        </span>
        <span className="ext-help-text">
          <strong>You&apos;re signed in on the website</strong>
          <span className="muted">
            Open the AI Checker extension. If you see &quot;Sign in&quot;, click it to finish
            signing in there too.
          </span>
        </span>
        <span className="ext-help-toggle">
          <span className="ext-help-toggle-closed">
            Where do I find the extension?
            <svg className="ext-help-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="ext-help-toggle-open">
            Hide instructions
            <svg className="ext-help-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      </summary>

      <div className="ext-help-body">
        <h4>Find AI Checker in Chrome</h4>

        <div className="ext-help-content">
          <div className="ext-help-steps">
            <div className="ext-help-step">
              <span className="ext-help-step-num">1</span>
              <div>
                <strong>
                  Click the puzzle-piece icon <PuzzlePieceIcon size={14} />
                </strong>
                <p className="muted">Look at the top-right corner of Chrome, next to the address bar.</p>
              </div>
            </div>
            <div className="ext-help-step">
              <span className="ext-help-step-num">2</span>
              <div>
                <strong>Select AI Checker</strong>
                <p className="muted">
                  In the menu that opens, click <strong>AI Checker</strong>, or click a pin icon to
                  add it to toolbar.
                </p>
              </div>
            </div>
          </div>

          <div className="ext-help-mock" aria-hidden="true">
            <div className="ext-help-mock-toolbar">
              <span className="ext-help-mock-addressbar">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />
                </svg>
                werida.io
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="m12 3 2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6Z" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="ext-help-mock-btn ext-help-mock-puzzle">
                <PuzzlePieceIcon size={15} />
                <span className="ext-help-mock-badge">1</span>
              </span>
              <span className="ext-help-mock-btn">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="3.2" />
                  <path d="M5 20c0-3.5 3-5.3 7-5.3s7 1.8 7 5.3" strokeLinecap="round" />
                </svg>
              </span>
              <span className="ext-help-mock-btn">
                <svg viewBox="0 0 24 24" width="4" height="15" fill="currentColor">
                  <circle cx="2" cy="2" r="2" />
                  <circle cx="2" cy="7.5" r="2" />
                  <circle cx="2" cy="13" r="2" />
                </svg>
              </span>
            </div>

            <div className="ext-help-mock-dropdown">
              <div className="ext-help-mock-dropdown-header">Extensions</div>
              <div className="ext-help-mock-dropdown-row">
                <span className="ext-help-mock-badge ext-help-mock-badge-row">2</span>
                <span className="ext-help-mock-ext-icon">
                  <LogoBadge size={18} />
                </span>
                <span className="ext-help-mock-ext-name">AI Checker</span>
                <PinIcon size={13} />
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                  <circle cx="2" cy="2" r="2" />
                  <circle cx="2" cy="7.5" r="2" />
                  <circle cx="2" cy="13" r="2" />
                </svg>
              </div>
              <div className="ext-help-mock-dropdown-footer">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" />
                  <path
                    d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.3-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Manage extensions
              </div>
            </div>
            <p className="ext-help-caption muted">Chrome toolbar · top-right corner</p>
          </div>
        </div>

        <div className="ext-help-final">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p>
            <strong>Then sign in if needed.</strong>{" "}
            <span className="muted">
              If you see &quot;Sign in&quot;, click it. If prompted, use the same email you use on
              this website.
            </span>
          </p>
        </div>
      </div>
    </details>
  );
}
