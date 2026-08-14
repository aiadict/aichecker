import { useState } from "react";
import { API_BASE_URL, CHROME_STORE_URL } from "../../lib/config";
import { logRating } from "../../lib/api";

// Lucide's "star" icon path (MIT licensed) — kept as an outline-friendly
// path so the same shape works both filled (rated) and stroke-only
// (unrated), matching the rest of the icon-bar's stroke-based style.
const STAR_PATH =
  "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";

export default function RateUsTab() {
  const [hovered, setHovered] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  // 1-3 stars: a private feedback form, not the public store listing —
  // protects the public rating from an unhappy user's first reaction
  // while still capturing it. 4-5 stars: straight to the Chrome Web
  // Store listing, no detour.
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
    setPicked(n);
  }

  const activeCount = hovered || picked || 0;

  return (
    <div style={{ textAlign: "center", padding: "40px 0" }}>
      <p style={{ marginTop: 0, marginBottom: 20, fontWeight: 600 }}>How's AI Checker working for you?</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 10 }} onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= activeCount;
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
                width="36"
                height="36"
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
      {picked && (
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          Thanks! Opening in a new tab…
        </p>
      )}
    </div>
  );
}
