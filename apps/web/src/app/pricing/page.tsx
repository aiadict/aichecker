import { createSupabaseServerClient } from "@/lib/supabase/server";
import PricingPlans, { type PlanRow } from "./components/PricingPlans";

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("plans")
    .select("key, name, monthly_credits, price_cents, price_cents_annual, is_featured")
    .order("price_cents", { ascending: true })
    .returns<PlanRow[]>();

  return (
    <div className="container">
      <div style={{ textAlign: "center" }}>
        <h1>Pricing</h1>
        <p style={{ fontSize: 22, fontWeight: 800, color: "var(--fg)", margin: "0 0 8px" }}>
          Same AI detection quality on every plan.
        </p>
        <p className="muted" style={{ maxWidth: 560, margin: "0 auto" }}>
          Paste text, right-click a selection, or use the floating icon. Choose the monthly word
          allowance that suits you.
        </p>
      </div>
      <PricingPlans plans={data ?? []} />
    </div>
  );
}
