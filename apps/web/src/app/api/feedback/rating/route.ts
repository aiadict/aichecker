import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

interface FeedbackRatingBody {
  id: string;
  rating?: number;
  message?: string;
  email?: string;
}

/**
 * Backs the extension's "Rate us" tab (bare rating, no message) AND the
 * /feedback page's form submission (adds message/email to that same
 * rating) — both call this same endpoint with the same client-generated
 * `id`. Supabase's upsert only sets the JSON keys actually present in the
 * body, so the extension's initial `{id, rating}` call never touches
 * message/email, and the web page's later `{id, message, email}` call
 * (no `rating` key) leaves the already-set rating untouched — one row per
 * rating, not two, without needing separate insert/update code paths.
 *
 * No hard requirement on user/device identity, unlike /api/checks —
 * there's no credit/billing action being gated here, so a fully
 * anonymous submission (a plain browser tab, no session, no
 * X-Device-Id — that header's an extension-only concept) is expected and
 * fine.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  const deviceId = req.headers.get("x-device-id");
  const body = (await req.json()) as FeedbackRatingBody;

  if (!body.id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const row: Record<string, unknown> = { id: body.id };
  if (body.rating !== undefined) row.rating = body.rating;
  if (body.message !== undefined) row.message = body.message;
  if (body.email !== undefined) row.email = body.email;
  if (user) row.user_id = user.id;
  if (deviceId) row.device_id = deviceId;

  const { error } = await admin.from("feedback_ratings").upsert(row);
  if (error) {
    console.error("Failed to upsert feedback_ratings", error);
    return NextResponse.json({ ok: false, error: "upstream_error" }, { status: 500 });
  }

  // Only a written comment needs a human to look at it — a bare star
  // click (the extension's own call, no message field at all) never
  // reaches here. Best-effort: a failed send must not fail the request,
  // since the feedback itself is already safely stored regardless.
  if (body.message && body.message.trim()) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "feedback@send.werida.io",
          to: "support@werida.io",
          subject: `New AI Checker feedback${body.rating ? ` (${body.rating}★)` : ""}`,
          text: `Rating: ${body.rating ?? "none"}\nReply-to: ${body.email ?? "not given"}\n\n${body.message}`,
        }),
      });
    } catch (err) {
      console.error("Failed to send feedback notification email", err);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
