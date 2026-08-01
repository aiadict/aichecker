"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Only rendered for the check's owner (see page.tsx's isOwner check).
 * Updates go straight through the RLS-scoped browser client — the
 * column-scoped grant added in supabase/migrations/..._share_checks.sql
 * means this update can only ever touch is_public, never any other column
 * on the row, so there's no way for a user to doctor their own result and
 * then share it as if Pangram produced it.
 */
export default function ShareResultButton({
  checkId,
  shareSlug,
  initialIsPublic,
}: {
  checkId: string;
  shareSlug: string;
  initialIsPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function setPublic(next: boolean): Promise<boolean> {
    setBusy(true);
    const { error } = await getSupabaseBrowserClient().from("checks").update({ is_public: next }).eq("id", checkId);
    setBusy(false);
    if (error) {
      alert("Could not update sharing. Please try again.");
      return false;
    }
    setIsPublic(next);
    return true;
  }

  async function copyLink() {
    if (!isPublic) {
      const ok = await setPublic(true);
      if (!ok) return;
    }
    await navigator.clipboard.writeText(`${window.location.origin}/history/${shareSlug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <button className="link-button" onClick={copyLink} disabled={busy}>
        {copied ? "Link copied!" : "Share result"}
      </button>
      {isPublic && (
        <button
          className="link-button"
          onClick={() => setPublic(false)}
          disabled={busy}
          style={{ color: "var(--muted)" }}
        >
          Make private
        </button>
      )}
    </div>
  );
}
