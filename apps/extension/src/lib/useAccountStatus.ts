import { useEffect, useState } from "react";
import { getAuthToken, onAuthSessionChanged } from "./storage";
import { onCreditsChanged } from "./events";
import { getMe, getTrialStatus } from "./api";
import type { MeResponse, TrialStatusResponse } from "@ai-checker/shared-types";

export interface AccountStatus {
  signedIn: boolean | null;
  me: MeResponse | null;
  trial: TrialStatusResponse | null;
}

// Shared by Header (the credits readout shown on every tab) and
// SettingsTab (the Account card) - both need the exact same signed-in /
// credits / trial state. Used to be fetched independently in each, which
// meant two copies of the same refresh logic that could silently drift.
export function useAccountStatus(): AccountStatus {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [trial, setTrial] = useState<TrialStatusResponse | null>(null);

  useEffect(() => {
    function refresh() {
      getAuthToken().then(async (token) => {
        setSignedIn(Boolean(token));
        if (token) {
          setMe(await getMe());
        } else {
          setMe(null);
          setTrial(await getTrialStatus());
        }
      });
    }

    // Once on mount, and again any time the stored session is set or
    // cleared afterward, or a check spends a credit (see lib/events.ts) —
    // the side panel is long-lived, unlike a popup's always-fresh mount,
    // so state that changes while it's already open needs to update live
    // rather than only on the next full remount.
    refresh();
    const unsubAuth = onAuthSessionChanged(refresh);
    const unsubCredits = onCreditsChanged(refresh);
    return () => {
      unsubAuth();
      unsubCredits();
    };
  }, []);

  return { signedIn, me, trial };
}
