"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function UpgradeButton({
  planKey,
  billingInterval,
  label,
}: {
  planKey: "pro" | "business";
  billingInterval: "month" | "year";
  label: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ planKey, billingInterval }),
    });
    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      setLoading(false);
      if (data.error === "already_subscribed") {
        alert("You already have an active plan. Manage or change it from \"Manage billing\" on your dashboard.");
      } else {
        alert("Something went wrong starting checkout. Please try again.");
      }
    }
  }

  return (
    <button className="cta-button" style={{ border: "none", cursor: "pointer" }} onClick={handleClick} disabled={loading}>
      {loading ? "Redirecting…" : label}
    </button>
  );
}
