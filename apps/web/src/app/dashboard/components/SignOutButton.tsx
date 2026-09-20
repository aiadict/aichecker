"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignOutButton({
  className = "link-button",
  icon = false,
}: {
  className?: string;
  icon?: boolean;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button className={className} onClick={handleSignOut}>
      {icon && (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      Sign out
    </button>
  );
}
