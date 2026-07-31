"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Only rendered for the check's owner (see page.tsx's isOwner check) — RLS
 * would refuse this for anyone else anyway (the delete policy is
 * auth.uid() = user_id), but there's no reason to show the button to a
 * visitor viewing someone else's publicly shared result.
 */
export default function DeleteCheckButton({ checkId }: { checkId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this check? This can't be undone.")) return;
    setDeleting(true);
    const { error } = await getSupabaseBrowserClient().from("checks").delete().eq("id", checkId);
    if (error) {
      setDeleting(false);
      alert("Could not delete this check. Please try again.");
      return;
    }
    router.push("/dashboard/history");
  }

  return (
    <button className="link-button" onClick={handleDelete} disabled={deleting} style={{ color: "#b91c1c" }}>
      {deleting ? "Deleting…" : "Delete this check"}
    </button>
  );
}
