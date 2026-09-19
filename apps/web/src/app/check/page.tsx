"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  countWords,
  creditsForWordCount,
  type CreateCheckRequest,
  type CreateCheckResponse,
  type MeResponse,
  type ParseFileResponse,
  type TrialStatusResponse,
} from "@ai-checker/shared-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device-id";
import CheckResultView from "../history/[slug]/components/CheckResultView";

// Mirrors apps/web/src/app/api/checks/route.ts's own limits exactly (via
// the same countWords helper) so this page's button never disagrees with
// what the server actually accepts - same reasoning as the extension's
// CheckForAiTab.tsx.
const MIN_WORDS = 50;
const MAX_CHARS = 50_000;

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // mirrors api/parse-file/route.ts

function fileExtension(name: string): string {
  const lower = name.toLowerCase();
  return lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
}

// A plain browser page has no chrome.storage-backed session of its own -
// grab the current cookie-based Supabase session (if any) and forward its
// access token as a Bearer header, exactly like any other caller of
// /api/checks. X-Device-Id is always sent too, for the anonymous-trial
// path (see lib/device-id.ts). Local, not shared - nothing else on the
// web side needs a check-submitting client yet.
async function authHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "X-Device-Id": getOrCreateDeviceId() };
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  return headers;
}

async function createCheck(text: string): Promise<CreateCheckResponse> {
  const headers = await authHeaders();
  const res = await fetch("/api/checks", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ text } satisfies CreateCheckRequest),
  });
  return res.json();
}

async function parseFile(file: File): Promise<ParseFileResponse> {
  const headers = await authHeaders();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/parse-file", { method: "POST", headers, body: form });
  return res.json();
}

async function fetchTrialStatus(): Promise<TrialStatusResponse> {
  const res = await fetch("/api/trial", { headers: { "X-Device-Id": getOrCreateDeviceId() } });
  return res.json();
}

async function fetchMe(): Promise<MeResponse | null> {
  const headers = await authHeaders();
  const res = await fetch("/api/me", { headers });
  if (!res.ok) return null;
  return res.json();
}

export default function CheckPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CreateCheckResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [trial, setTrial] = useState<TrialStatusResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function refreshStatus() {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const isSignedIn = Boolean(data.session);
      setSignedIn(isSignedIn);
      if (isSignedIn) {
        setMe(await fetchMe());
      } else {
        setMe(null);
        setTrial(await fetchTrialStatus());
      }
    }
    refreshStatus();
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => refreshStatus());
    return () => subscription.unsubscribe();
  }, []);

  const wordCount = countWords(text);
  const credits = creditsForWordCount(wordCount);
  const belowMinimum = wordCount < MIN_WORDS;
  const aboveMaximum = text.length > MAX_CHARS;

  async function handleCheck() {
    setLoading(true);
    setResponse(null);
    try {
      const res = await createCheck(text);
      setResponse(res);
      if (res.ok) {
        if (signedIn) setMe(await fetchMe());
        else setTrial(await fetchTrialStatus());
      }
    } catch {
      setResponse({ ok: false, error: "upstream_error", message: "Network error. Please try again." });
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
          setUploadError("Text can't be recognized - upload a valid text file.");
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
    e.target.value = "";
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="container" style={{ paddingBottom: 64 }}>
      <h1>Check your text for AI</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Paste your text or upload a file to check for signs of AI-generated writing.
        {!signedIn && (
          <>
            {" "}
            No account needed to try it;{" "}
            <Link href={`/login?redirectTo=${encodeURIComponent("/check")}`}>sign in</Link> for
            more credits and a saved history.
          </>
        )}
      </p>

      <div className="check-page-status">
        {signedIn && me ? (
          <>
            <span>Signed in as {me.email}</span>
            <span>
              <strong>
                {me.creditsRemaining}/{me.plan.monthlyCredits}
              </strong>{" "}
              credits
            </span>
          </>
        ) : signedIn ? (
          <span className="muted">Loading your account…</span>
        ) : (
          <span>
            {trial ? (
              <>
                <strong>{trial.trialCreditsRemaining}</strong> free{" "}
                {trial.trialCreditsRemaining === 1 ? "check" : "checks"} left on this browser
              </>
            ) : (
              "Loading…"
            )}
          </span>
        )}
        {!signedIn && (
          <Link className="link-button" href={`/login?redirectTo=${encodeURIComponent("/check")}`}>
            Sign in for more
          </Link>
        )}
      </div>

      <div className="card">
        <div className="check-page-label-row">
          <span className="check-page-label">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
              <path d="M14 3v5h5" strokeLinejoin="round" />
            </svg>
            Your text
          </span>
          <button
            type="button"
            className="check-page-upload-btn"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
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

        {uploadError && <p className="check-page-upload-error">{uploadError}</p>}

        <div
          className={`check-page-textarea-wrap${dragActive ? " drag-active" : ""}`}
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
          <div className="check-page-textarea-counter">
            {wordCount} {wordCount === 1 ? "word" : "words"}, {credits} {credits === 1 ? "credit" : "credits"}
          </div>
          {text.length > 0 && (
            <button className="check-page-clear-btn" onClick={() => setText("")} aria-label="Clear text">
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
          <p className="check-page-hint">Minimum 50 words required for accurate detection</p>
        )}
        {aboveMaximum && <p className="check-page-hint">This text is too long — please trim it before checking</p>}

        <button
          className="check-page-submit"
          disabled={belowMinimum || aboveMaximum || loading}
          onClick={handleCheck}
        >
          {loading ? "Checking…" : "Check for AI"}
        </button>

        {response && !response.ok && response.error === "unauthorized" && (
          <>
            {response.reason === "trial_exhausted" || response.reason === "anon_daily_cap_reached" ? (
              <p className="check-page-trial-exhausted">
                You&apos;ve used your free checks on this browser -{" "}
                <Link href={`/login?redirectTo=${encodeURIComponent("/check")}`}>sign in</Link> to keep going.
              </p>
            ) : (
              <p className="check-page-error">
                <Link href={`/login?redirectTo=${encodeURIComponent("/check")}`}>Sign in</Link> to check for AI.
              </p>
            )}
          </>
        )}
        {response && !response.ok && response.error === "text_too_short" && (
          <p className="check-page-error">That text is too short to check reliably.</p>
        )}
        {response && !response.ok && response.error === "text_too_long" && (
          <p className="check-page-error">That text is too long - please trim it.</p>
        )}
        {response && !response.ok && response.error === "insufficient_credits" && (
          <p className="check-page-error">
            You&apos;re out of credits - <Link href="/pricing">upgrade to keep checking</Link>.
          </p>
        )}
        {response && !response.ok && response.error === "daily_cap_reached" && (
          <p className="check-page-error">Daily free-plan limit reached - try again tomorrow.</p>
        )}
        {response && !response.ok && response.error === "upstream_error" && (
          <p className="check-page-error">{response.message}</p>
        )}
      </div>

      {response?.ok && (
        <CheckResultView
          fullText={response.result.fullText}
          wordCount={response.result.wordCount}
          prediction={response.result.prediction}
          predictionShort={response.result.predictionShort}
          fractionAi={response.result.fractionAi}
          fractionHuman={response.result.fractionHuman}
          fractionAiAssisted={response.result.fractionAiAssisted}
          windows={response.result.windows}
        />
      )}

      <div className="card check-page-guide-card" style={{ marginTop: 24 }}>
        <svg
          className="check-page-guide-icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" />
          <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
        </svg>
        <div className="check-page-guide-text">
          <h3>What does your AI score mean?</h3>
          <p className="muted">
            Your score estimates how much of your text reads as AI-generated. Learn what the
            percentages mean and how to interpret your results.
          </p>
        </div>
        <Link href="/resultsupport" className="check-page-guide-link">
          Read the results guide
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
