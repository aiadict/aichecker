import type { CreateCheckResponse, ShareCheckResponse } from "@ai-checker/shared-types";
import ResultCard, { describeCheckError } from "../components/ResultCard";

export type PanelState =
  | { status: "loading" }
  | { status: "done"; response: CreateCheckResponse }
  | { status: "error"; message: string };

// Always docked at a fixed viewport corner (see .panel in content/index.tsx's
// PANEL_CSS) rather than anchored near the selection — anchoring seemed
// nicer but a position: fixed element isn't reachable by scrolling the
// page at all, so a selection near the bottom of a long page pushed the
// panel partly or fully off-screen with no way to reach the rest of it.
// A fixed, predictable spot (matching how the popup always opens in the
// same place) trades a little context for always being fully visible and
// reachable.
export default function ResultPanel({
  state,
  onClose,
  shareFn,
}: {
  state: PanelState;
  onClose: () => void;
  shareFn: (id: string) => Promise<ShareCheckResponse>;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span>AI Checker</span>
        <button className="panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="panel-body">
        {state.status === "loading" && <p className="muted">Checking…</p>}
        {state.status === "error" && <p className="muted">{state.message}</p>}
        {state.status === "done" && !state.response.ok && (
          <p className="muted">{describeCheckError(state.response)}</p>
        )}
        {state.status === "done" && state.response.ok && (
          <ResultCard result={state.response.result} shareFn={shareFn} />
        )}
      </div>
    </div>
  );
}
