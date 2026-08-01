import type {
  CreateCheckRequest,
  CreateCheckResponse,
  CheckResult,
  MeResponse,
  ShareCheckResponse,
} from "@ai-checker/shared-types";
import { API_BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";
import { getAuthSession, setAuthSession, type AuthSession } from "./storage";

/**
 * Calls Supabase's token-refresh grant directly (no SDK needed for this one
 * call — keeps the extension bundle small, matching the "extension only
 * talks to apps/web" principle for everything except this narrow,
 * public-key-only auth exception; see docs/architecture.md).
 */
async function refreshSession(refreshToken: string): Promise<AuthSession | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!data.access_token || !data.refresh_token) return null;

  const session: AuthSession = { accessToken: data.access_token, refreshToken: data.refresh_token };
  await setAuthSession(session);
  return session;
}

function buildRequest(path: string, session: AuthSession | null, init?: RequestInit): [string, RequestInit] {
  return [
    `${API_BASE_URL}${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...init?.headers,
      },
    },
  ];
}

/**
 * Fetch wrapper that retries once, with a refreshed access token, on a 401
 * — Supabase access tokens expire (~1hr default) well before a user
 * necessarily closes the browser. Falls back to signing the user out
 * locally (setAuthSession(null)) if the refresh token itself is no longer
 * valid, so the UI correctly falls back to "Not signed in" / "Sign in".
 */
async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await getAuthSession();
  const res = await fetch(...buildRequest(path, session, init));

  if (res.status !== 401 || !session?.refreshToken) return res;

  const refreshed = await refreshSession(session.refreshToken);
  if (!refreshed) {
    await setAuthSession(null);
    return res;
  }

  return fetch(...buildRequest(path, refreshed, init));
}

export async function createCheck(req: CreateCheckRequest): Promise<CreateCheckResponse> {
  const res = await authedFetch("/api/checks", {
    method: "POST",
    body: JSON.stringify(req),
  });
  return res.json();
}

export async function listRecentChecks(limit = 5): Promise<CheckResult[]> {
  const res = await authedFetch(`/api/checks?limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

export async function getMe(): Promise<MeResponse | null> {
  const res = await authedFetch("/api/me");
  if (!res.ok) return null;
  return res.json();
}

export async function shareCheck(id: string): Promise<ShareCheckResponse> {
  const res = await authedFetch(`/api/checks/${id}/share`, { method: "POST" });
  return res.json();
}
