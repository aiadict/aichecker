import type {
  CreateCheckRequest,
  CreateCheckResponse,
  CheckResult,
  MeResponse,
  TrialStatusResponse,
} from "@ai-checker/shared-types";
import { API_BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";
import { getAuthSession, setAuthSession, getOrCreateDeviceId, type AuthSession } from "./storage";

/**
 * Calls Supabase's token-refresh grant directly (no SDK needed for this one
 * call — keeps the extension bundle small, matching the "extension only
 * talks to apps/web" principle for everything except this narrow,
 * public-key-only auth exception; see docs/architecture.md).
 */
let refreshPromise: Promise<AuthSession | null> | null = null;

async function refreshSession(refreshToken: string): Promise<AuthSession | null> {
  // Dedup concurrent refreshes. Supabase refresh tokens are single-use, so
  // two authedFetch calls hitting a 401 around the same moment — e.g.
  // Header's getMe() and whatever tab is mounted alongside it, both firing
  // on the same panel open — would otherwise race to redeem the same
  // refresh token: the loser gets rejected and wipes the session the
  // winner just successfully stored. Confirmed live: Header showed a
  // valid credits count while the very next "Check for AI" click got an
  // immediate unauthorized error.
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
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
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

function buildRequest(
  path: string,
  session: AuthSession | null,
  deviceId: string,
  init?: RequestInit
): [string, RequestInit] {
  return [
    `${API_BASE_URL}${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        // Read only by the server when there's no session — identifies the
        // anonymous trial's one-time 2 credits (see /api/checks, /api/trial).
        // Harmless no-op otherwise, so it's always sent rather than only
        // sometimes.
        "X-Device-Id": deviceId,
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
 * Works unauthenticated too (no session, no retry-on-401 attempted) — the
 * anonymous trial flow just rides on the X-Device-Id header instead.
 */
async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const [session, deviceId] = await Promise.all([getAuthSession(), getOrCreateDeviceId()]);
  const res = await fetch(...buildRequest(path, session, deviceId, init));

  if (res.status !== 401 || !session?.refreshToken) return res;

  const refreshed = await refreshSession(session.refreshToken);
  if (!refreshed) {
    await setAuthSession(null);
    return res;
  }

  return fetch(...buildRequest(path, refreshed, deviceId, init));
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

export async function getTrialStatus(): Promise<TrialStatusResponse> {
  const res = await authedFetch("/api/trial");
  if (!res.ok) return { trialCreditsRemaining: 0 };
  return res.json();
}

