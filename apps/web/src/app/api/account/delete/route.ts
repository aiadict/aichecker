import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasRenewingSubscription } from "@/lib/subscriptions";

type DeleteAccountResponse =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "active_subscription" | "delete_failed" };

/**
 * Full account deletion — deletes the auth.users row, which cascades to
 * every owned row (users, subscriptions, credit_balances, checks,
 * check_windows — see supabase/migrations/20260729000001_init_schema.sql's
 * "on delete cascade" FKs) via the admin client, the only client with
 * permission to delete an auth user at all.
 *
 * Blocks deletion while a subscription is still set to RENEW (see
 * lib/subscriptions.ts's hasRenewingSubscription) rather than cancelling it
 * on the user's behalf: STRIPE_SECRET_KEY is a restricted key with
 * read-only access to Subscriptions (see lib/stripe.ts) by design, so this
 * route genuinely cannot call subscriptions.cancel(). Directing the user
 * through the Customer Portal first (which we do have write access to)
 * also means Stripe's own cancellation confirmation is what the user sees,
 * not something we did silently on their behalf. Once they've cancelled
 * there (cancel_at_period_end = true), deletion is allowed immediately —
 * no need to wait out the rest of the billing period first.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json<DeleteAccountResponse>({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, cancel_at_period_end, plans(key)")
    .eq("user_id", user.id)
    .single<{ status: string; cancel_at_period_end: boolean; plans: { key: string } | { key: string }[] }>();

  const planKey = sub ? (Array.isArray(sub.plans) ? sub.plans[0]?.key : sub.plans?.key) : "free";

  if (hasRenewingSubscription({ status: sub?.status, cancelAtPeriodEnd: sub?.cancel_at_period_end, planKey })) {
    return NextResponse.json<DeleteAccountResponse>(
      { ok: false, error: "active_subscription" },
      { status: 409 }
    );
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("Failed to delete user", user.id, error);
    return NextResponse.json<DeleteAccountResponse>(
      { ok: false, error: "delete_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json<DeleteAccountResponse>({ ok: true });
}
