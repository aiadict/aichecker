import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./supabase/admin";

export interface AuthenticatedUser {
  id: string;
  email: string | undefined;
}

/**
 * Verifies the `Authorization: Bearer <token>` header against Supabase Auth
 * and returns the authenticated user, or null if missing/invalid/expired.
 * Token verification happens against Supabase's Auth server regardless of
 * which client instance calls it — using the admin client here is just
 * reuse, not a security downgrade (auth.getUser only ever returns the user
 * matching the token itself, nothing else).
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email };
}
