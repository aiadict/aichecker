import { useEffect, useState } from "react";
import { API_BASE_URL, CHROME_STORE_URL } from "../../lib/config";
import { logRating } from "../../lib/api";
import { getHasRated, setHasRated } from "../../lib/storage";

// Lucide's "star" icon path (MIT licensed) — kept as an outline-friendly
// path so the same shape works both filled (rated) and stroke-only
// (unrated), matching the rest of the icon-bar's stroke-based style.
const STAR_PATH =
  "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";

/**
 * Sits directly under CheckForAiTab's "Check for AI" button. Shown only
 * until the user rates — clicking any star hides it for good (see
 * lib/storage.ts's getHasRated/setHasRated), since that click already
 * sends them on to the feedback form or the Chrome Web Store review page;
 * there's nothing left for the prompt itself to do afterward.
 */
export default function RateUsPrompt() {
  // null = still reading storage, not "unrated" — prevents a one-frame
  // flash of the prompt for a user who already rated, before the real
  // value loads.
  const [hasRated, setHasRatedState] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(0);

  useEffect(() => {
    getHasRated().then(setHasRatedState);
  }, []);

  // 1-3 stars: a private feedback form, not the public store listing —
  // protects the public rating from an unhappy user's first reaction
  // while still capturing it. 4-5 stars: straight to the Chrome Web
  // Store's reviews section.
  //
  // The id is generated here rather than returned from an API call
  // because window.open() has to run synchronously inside this click
  // handler or Chrome's popup blocker can silently kill it — there's no
  // time to await a round-trip first. logRating() fires in parallel,
  // unawaited; if the user later writes a comment on /feedback, that
  // page reuses this same id so the two merge into one row instead of
  // creating a second (see supabase/migrations/20260814000002_feedback_ratings.sql).
  function handleClick(n: number) {
    const id = crypto.randomUUID();
    if (n <= 3) {
      window.open(`${API_BASE_URL}/feedback?rating=${n}&id=${id}`, "_blank", "noopener");
    } else {
      window.open(CHROME_STORE_URL, "_blank", "noopener");
    }
    logRating({ id, rating: n });
    setHasRated();
    setHasRatedState(true);
  }

  if (hasRated !== false) return null;

  return (
    <div style={{ textAlign: "center", marginTop: 20 }}>
      <p style={{ margin: "0 0 10px", fontWeight: 600, fontSize: 13.5 }}>Enjoying AI Checker?</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }} onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= hovered;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onMouseEnter={() => setHovered(n)}
              onClick={() => handleClick(n)}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 0 }}
            >
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill={filled ? "var(--brand)" : "none"}
                stroke={filled ? "var(--brand)" : "var(--border)"}
                strokeWidth="1.6"
                strokeLinejoin="round"
              >
                <path d={STAR_PATH} />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
