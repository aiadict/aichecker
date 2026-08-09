export interface SubscriptionGateRow {
  status: string | null | undefined;
  cancelAtPeriodEnd: boolean | null | undefined;
  planKey: string | null | undefined;
}

/**
 * True when a subscription will keep renewing/billing if left alone —
 * i.e. still needs to go through Stripe (Manage billing) before certain
 * actions in our app are safe: deleting the account (would strand the
 * customer with no way to stop future charges), or starting a brand new
 * Checkout Session for another plan (would create a SECOND subscription
 * alongside the first rather than replacing it — confirmed live: a
 * customer completed checkout twice for the same plan after a payment
 * method mixup, and nothing stopped a second Stripe Subscription object
 * from being created for the same customer, silently double-billing
 * them).
 *
 * A subscription already scheduled to end (cancelAtPeriodEnd) does NOT
 * count, even though Stripe's own `status` stays "active" right up until
 * the period actually ends — Stripe has already committed to not
 * renewing it, so there's nothing left to protect against, and blocking
 * on it just traps the user in a loop where "cancel first" can never be
 * satisfied by anything they can do today.
 */
export function hasRenewingSubscription(row: SubscriptionGateRow | null | undefined): boolean {
  if (!row) return false;
  if (!row.planKey || row.planKey === "free") return false;
  if (!row.status || row.status === "canceled") return false;
  if (row.cancelAtPeriodEnd) return false;
  return true;
}
