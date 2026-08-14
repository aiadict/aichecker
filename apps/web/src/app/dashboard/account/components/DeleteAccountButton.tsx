"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DeleteAccountButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        "Delete your account? This permanently removes your account, check history, and remaining " +
          "credits, and billing records after any required retention period - it can't be undone. " +
          "Re-registering with the same email later starts over at 0 credits."
      )
    ) {
      return;
    }

    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();

    if (data.ok) {
      await supabase.auth.signOut();
      router.push("/");
      return;
    }

    setBusy(false);
    if (data.error === "active_subscription") {
      alert(
        "You have an active paid subscription. Please cancel it first from \"Manage billing\" " +
          "on the dashboard, then come back here to delete your account."
      );
    } else {
      alert("Could not delete your account. Please try again or email support@werida.io.");
    }
  }

  return (
    <button className="link-button" onClick={handleDelete} disabled={busy} style={{ color: "#b91c1c" }}>
      {busy ? "Deleting…" : "Delete my account"}
    </button>
  );
}
