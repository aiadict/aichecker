// TODO: replace with real Supabase reads/writes once a project exists
// (supabase/migrations + supabase/seed.sql define the target schema).
// This in-memory store exists purely so the API routes and dashboard pages
// are exercisable end to end during Phase-1 scaffolding, before Supabase is
// provisioned. It resets on every server restart/deploy — do not rely on it
// for anything real.

import type { CheckResult } from "@ai-checker/shared-types";
import { randomUUID } from "node:crypto";

const store: CheckResult[] = [];

export const MOCK_FREE_PLAN = {
  monthlyCredits: 10,
  dailyCap: 4,
};

let mockCreditsRemaining = MOCK_FREE_PLAN.monthlyCredits;

export function getMockCreditsRemaining(): number {
  return mockCreditsRemaining;
}

export function deductMockCredits(amount: number): void {
  mockCreditsRemaining = Math.max(0, mockCreditsRemaining - amount);
}

export function addCheck(check: Omit<CheckResult, "id" | "createdAt">): CheckResult {
  const full: CheckResult = {
    ...check,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  store.unshift(full);
  return full;
}

export function listChecks(limit = 20): CheckResult[] {
  return store.slice(0, limit);
}

export function findByShareSlug(slug: string): CheckResult | undefined {
  return store.find((c) => c.shareSlug === slug);
}
