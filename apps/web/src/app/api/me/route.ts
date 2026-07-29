import { NextRequest, NextResponse } from "next/server";
import type { MeResponse } from "@ai-checker/shared-types";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

interface CreditBalanceWithPlanRow {
  credits_remaining: number;
  checks_today: number;
  plans: {
    key: MeResponse["plan"]["key"];
    name: string;
    monthly_credits: number;
    daily_cap: number | null;
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("credit_balances")
    .select("credits_remaining, checks_today, plans(key, name, monthly_credits, daily_cap)")
    .eq("user_id", user.id)
    .single<CreditBalanceWithPlanRow>();

  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const plan = Array.isArray(data.plans) ? data.plans[0] : data.plans;

  const response: MeResponse = {
    email: user.email ?? "",
    plan: {
      key: plan.key,
      name: plan.name,
      monthlyCredits: plan.monthly_credits,
      dailyCap: plan.daily_cap,
    },
    creditsRemaining: data.credits_remaining,
    checksToday: data.checks_today,
  };

  return NextResponse.json(response);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
