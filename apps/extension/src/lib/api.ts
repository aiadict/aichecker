import type { CreateCheckRequest, CreateCheckResponse, CheckResult } from "@ai-checker/shared-types";
import { API_BASE_URL } from "./config";
import { getAuthToken } from "./storage";

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAuthToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
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
