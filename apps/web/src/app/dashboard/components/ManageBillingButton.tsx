"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      setLoading(false);
      // no_stripe_customer is expected for anyone still on the Free plan.
      if (data.error !== "no_stripe_customer") alert("Could not open billing management. Please try again.");
    }
  }

  return (
    <button className="link-button" onClick={handleClick} disabled={loading} style={{ marginLeft: 12 }}>
      {loading ? "Opening…" : "Manage billing"}
    </button>
  );
}
