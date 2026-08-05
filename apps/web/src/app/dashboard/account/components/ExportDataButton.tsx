"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Client-side export straight through the RLS-scoped browser client — no
 * API route needed, since RLS already limits this query to the caller's
 * own rows (same pattern as dashboard/history's server-side equivalent).
 */
export default function ExportDataButton() {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: checks, error } = await supabase
      .from("checks")
      .select(
        "id, full_text, word_count, prediction, prediction_short, fraction_ai, fraction_human, fraction_ai_assisted, source_url, is_public, created_at"
      )
      .order("created_at", { ascending: false });

    setBusy(false);
    if (error) {
      alert("Could not export your data. Please try again.");
      return;
    }

    const payload = { email: user?.email, exportedAt: new Date().toISOString(), checks };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-checker-data-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button className="link-button" onClick={handleExport} disabled={busy}>
      {busy ? "Preparing…" : "Export my data"}
    </button>
  );
}
