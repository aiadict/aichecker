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
      <h1>Pricing</h1>
      <p className="muted" style={{ maxWidth: 560 }}>
        Every plan includes the same detection quality — paste, right-click, or the floating
        icon all work the same way. What changes is how many words you can check each month.
      </p>
      <PricingPlans plans={data ?? []} />
    </div>
  );
}
