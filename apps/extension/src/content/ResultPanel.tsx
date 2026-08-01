import type { CreateCheckResponse, ShareCheckResponse } from "@ai-checker/shared-types";
import ResultCard, { describeCheckError } from "../components/ResultCard";

export type PanelState =
  | { status: "loading" }
  | { status: "done"; response: CreateCheckResponse }
  | { status: "error"; message: string };

export interface PanelPosition {
  top: number;
  left: number;
}

export default function ResultPanel({
  state,
  position,
  onClose,
  shareFn,
}: {
  state: PanelState;
  position: PanelPosition | null;
  onClose: () => void;
  shareFn: (id: string) => Promise<ShareCheckResponse>;
}) {
  return (
    <div
      className="panel"
      style={position ? { top: position.top, left: position.left } : { bottom: 20, right: 20 }}
    >
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
