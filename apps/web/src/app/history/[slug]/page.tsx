import { notFound } from "next/navigation";
import { findByShareSlug } from "@/lib/mock-store";

// Public, read-only shared result page — mirrors Pangram's
// pangram.com/history/<uuid> pattern. Private by default; only reachable if
// the owner set is_public=true (mock-store doesn't enforce this yet — TODO
// once Supabase RLS backs this route, per supabase/migrations §rls).
export default async function SharedCheckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const check = findByShareSlug(slug);
  if (!check) notFound();

  return (
    <div className="container">
      <h1>Check result</h1>
      <div className="card">
        <p>{check.textSnippet}</p>
        <p className={`pill ${check.predictionShort}`}>{check.prediction}</p>
        <p className="muted">{check.wordCount} words</p>
      </div>
    </div>
  );
}
