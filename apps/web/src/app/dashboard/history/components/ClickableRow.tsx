"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

// Next's <Link> can't wrap a <tr> (invalid HTML — a <tr>'s only valid
// children are cells), so the whole-row click target needs an explicit
// client-side navigate instead of the badge-only Link this replaces.
export default function ClickableRow({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr className="clickable-row" onClick={() => router.push(href)}>
      {children}
    </tr>
  );
}
