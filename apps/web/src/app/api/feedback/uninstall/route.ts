import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

interface UninstallFeedbackBody {
  reason?: string;
  deviceId?: string;
}

/**
 * Backs /uninstall (see that page's doc comment and
 * apps/extension/src/background/index.ts's setUninstallURL call). No auth
 * requirement, same reasoning as /api/feedback/rating - by the time this
 * page loads the extension is already gone, so there's no session to
 * check, and this is a plain survey submission, not a credit/billing
 * action that needs gating.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as UninstallFeedbackBody;
  const reason = body.reason?.trim();

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("uninstall_feedback").insert({
    reason: reason || null,
    device_id: body.deviceId || null,
  });
  if (error) {
    console.error("Failed to insert uninstall_feedback", error);
    return NextResponse.json({ ok: false, error: "upstream_error" }, { status: 500 });
  }

  // Best-effort, same as /api/feedback/rating - a failed send must not
  // fail the request, since the feedback itself is already safely stored
  // regardless. Only sent when there's an actual reason to read; an empty
  // submission (user hit Submit with nothing typed) doesn't need a human.
  if (reason) {
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
          subject: "AI Checker extension uninstalled",
          text: `Reason: ${reason}\n\nDevice: ${body.deviceId ?? "unknown"}`,
        }),
      });
    } catch (err) {
      console.error("Failed to send uninstall notification email", err);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
