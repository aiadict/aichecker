import { useEffect, useRef, useState } from "react";
import { createCheck, parseFile } from "../../lib/api";
import { notifyCreditsChanged } from "../../lib/events";
import { onAuthSessionChanged } from "../../lib/storage";
import { countWords, creditsForWordCount, type CreateCheckResponse } from "@ai-checker/shared-types";
import ResultCard, { describeCheckError } from "../../components/ResultCard";
import RateUsPrompt from "../components/RateUsPrompt";
import PanelSectionHeader from "../components/PanelSectionHeader";
import ResizeHintBanner from "../components/ResizeHintBanner";

// Word-based, not character-based — matches the backend's own minimum
// (apps/web/src/app/api/checks/route.ts) exactly, via the same countWords
// helper, so the button's enabled state and the server's validation can
// never disagree on what "50 words" means.
const MIN_WORDS = 50;
// Character-based, mirroring apps/web/src/app/api/checks/route.ts's own
// MAX_CHARS exactly — a payload-size guard, not a detection-quality one,
// so it's checked separately from MIN_WORDS above.
const MAX_CHARS = 50_000;

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — mirrors apps/web/src/app/api/parse-file/route.ts

function fileExtension(name: string): string {
  const lower = name.toLowerCase();
  return lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
}

export default function CheckForAiTab({
  prefillText,
  autoRunToken,
}: {
  prefillText: string;
  autoRunToken?: number;
}) {
  const [text, setText] = useState(prefillText);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CreateCheckResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefillText) setText(prefillText);
  }, [prefillText]);

  const wordCount = countWords(text);
  const credits = creditsForWordCount(wordCount);
  const belowMinimum = wordCount < MIN_WORDS;
  const aboveMaximum = text.length > MAX_CHARS;

  // Accepts an override so an auto-run (below) doesn't depend on `text`
  // state having already caught up to a just-arrived prefillText in the
  // same render — the two are set from separate effects, so reading `text`
  // directly here would risk a stale value.
  async function handleCheck(overrideText?: string) {
    setLoading(true);
    setResponse(null);
    try {
      const res = await createCheck({ text: overrideText ?? text });
      setResponse(res);
      if (res.ok) notifyCreditsChanged();
    } catch {
      setResponse({ ok: false, error: "upstream_error", message: "Network error. Is apps/web running?" });
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(file: File) {
    setUploadError(null);

    const ext = fileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError("Unsupported file type. Upload a PDF, DOCX, or TXT file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("That file is too large (max 10MB).");
      return;
    }

    setUploading(true);
    const res = await parseFile(file);
    setUploading(false);

    if (!res.ok) {
      switch (res.error) {
        case "unrecognized_text":
          setUploadError("Text can't be recognized - upload valid text file.");
          break;
        case "legacy_doc_unsupported":
          setUploadError("We can't read old .doc files - please save this as .docx or .pdf and try again.");
          break;
        case "file_too_large":
          setUploadError("That file is too large (max 10MB).");
          break;
        case "unsupported_type":
          setUploadError("Unsupported file type. Upload a PDF, DOCX, or TXT file.");
          break;
        case "upstream_error":
          setUploadError(res.message);
          break;
        default:
          setUploadError("Something went wrong reading that file. Please try again.");
      }
      return;
    }

    setText(res.text);
    setResponse(null);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allows re-selecting the same file consecutively
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  useEffect(() => {
    // Fires once per real pending selection (floating icon / right-click
    // "Check for AI Content" — see panel/App.tsx), not on plain typing.
    // Skips straight past the extra "now click Check for AI" step, since
    // the whole point of selecting text and clicking that icon is to check
    // it, not just to paste it. Under the word minimum, do nothing and let
    // the existing "Minimum 50 words" hint show, same as manual typing.
    if (!autoRunToken) return;
    if (countWords(prefillText) < MIN_WORDS) return;
    handleCheck(prefillText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunToken]);

  useEffect(() => {
    // Clears a stale "sign in to keep going" message the moment the user
    // actually signs in elsewhere (e.g. the /login?source=extension tab)
    // — mirrors Header.tsx/SettingsTab.tsx's own onAuthSessionChanged
    // subscription. Without this, the old unauthorized response just sat
    // here until the user switched tabs and back, since nothing in this
    // component was watching auth state. Only clears an unauthorized
    // error specifically — a result card or a different error stays put.
    return onAuthSessionChanged(() => {
      setResponse((prev) => (prev && !prev.ok && prev.error === "unauthorized" ? null : prev));
    });
  }, []);

  return (
    <div className="check-tab">
      {/* Hidden while a result is showing — ResultCard renders its own
          "Your result" / "Open web checker" header directly below this
          slot, and showing both stacked was a real, live-caught bug (two
          "Open web checker" links on screen at once). Reappears the
          moment the result is dismissed (onClose below sets response back
          to null), so there's still always exactly one header visible. */}
      {!response?.ok && <PanelSectionHeader title="Check text" />}

      {response && !response.ok && response.error === "unauthorized" && (
        <>
          {/* Header's own Sign-in pill is always visible directly above,
              on every tab — no need to duplicate it here (see
              apps/extension/src/panel/components/Header.tsx). Only the
              wording changes based on `reason`: reaching the trial's own
              limit or the shared daily cap both mean "you had free
              checks and used them", a different situation from any other
              unauthenticated attempt — and unlike a plain "sign in to
              check" prompt, this one needs to visibly announce that
              something DID happen (the check was blocked, not silently
              dropped), so it gets its own bold red style instead of the
              plain .muted treatment. */}
          {response.reason === "trial_exhausted" || response.reason === "anon_daily_cap_reached" ? (
            <p className="trial-exhausted-notice">
              You&apos;ve used your 2 free checks - sign in to keep going.
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
              Sign in to check for AI.
            </p>
          )}
        </>
      )}
      {response && !response.ok && response.error !== "unauthorized" && (
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          {describeCheckError(response)}
        </p>
      )}

      {response?.ok && <ResultCard result={response.result} onClose={() => setResponse(null)} />}

      <div className="check-text-label-row">
        <span className="check-text-label">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
            <path d="M14 3v5h5" strokeLinejoin="round" />
          </svg>
          Your text
        </span>
        <button
          type="button"
          className="upload-file-btn"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 16V4" strokeLinecap="round" />
            <path d="M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {uploading ? "Uploading…" : "Upload file"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
      </div>

      {uploadError && <p className="upload-error">{uploadError}</p>}

      <div
        className={`textarea-wrap${dragActive ? " drag-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <textarea
          placeholder={"Paste your text here…\nArticles, essays, emails, and more."}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="textarea-counter">
          {wordCount} {wordCount === 1 ? "Word" : "Words"}, {credits} {credits === 1 ? "Credit" : "Credits"}
        </div>
        {text.length > 0 && (
          <button className="clear-text-btn" onClick={() => setText("")} aria-label="Clear text">
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M4 6h12M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6M5.5 6l.6 9a1 1 0 0 0 1 .9h5.8a1 1 0 0 0 1-.9l.6-9"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {text.length > 0 && belowMinimum && (
        <p className="min-words-hint">Minimum 50 words required for accurate detection</p>
      )}
      {aboveMaximum && (
        <p className="min-words-hint">This text is too long — please trim it before checking</p>
      )}

      <button
        className="primary-button"
        disabled={belowMinimum || aboveMaximum || loading}
        onClick={() => handleCheck()}
      >
        {loading ? "Checking…" : "Check for AI"}
      </button>

      <RateUsPrompt />
      <ResizeHintBanner />
    </div>
  );
}
