import { NextRequest, NextResponse } from "next/server";
import type { ShareCheckResponse } from "@ai-checker/shared-types";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Extension-facing counterpart to the web dashboard's ShareResultButton
// (which updates is_public directly through the RLS-scoped browser
// client). The extension has no Supabase session of its own — it only
// ever talks to this backend — so it needs a route that does the same
// update server-side instead.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json<ShareCheckResponse>({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = getSupabaseAdmin();

  // The admin client bypasses RLS, so ownership is checked explicitly via
  // the .eq("user_id", ...) filter rather than relying on a policy — a
  // mismatched id/user just means zero rows update, reported as not_found.
  const { data, error } = await admin
    .from("checks")
    .update({ is_public: true })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("share_slug")
    .single();

  if (error || !data) {
    return NextResponse.json<ShareCheckResponse>({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json<ShareCheckResponse>({ ok: true, shareSlug: data.share_slug });
}
