"use client";

import { useEffect, useRef } from "react";

// All events the frontend tracks for AI profiling
type BehaviorEvent =
  | "profile_view"
  | "post_view"
  | "story_view"
  | "story_view_complete"
  | "search_query"
  | "room_join"
  | "swipe_right"
  | "swipe_left"
  | "session_start"
  | "session_end"
  | "scroll_depth"
  | "reaction";

interface TrackOptions {
  target_id?: string;
  metadata?: Record<string, unknown>;
  session_id?: string;
}

let _sessionId: string | null = null;
function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = sessionStorage.getItem("cc_session") ?? crypto.randomUUID();
    sessionStorage.setItem("cc_session", _sessionId);
  }
  return _sessionId;
}

/** Fire-and-forget behavioral event to the backend. Never throws. */
export async function trackEvent(event: BehaviorEvent, opts: TrackOptions = {}): Promise<void> {
  try {
    await fetch("/api/v1/feed/track", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: event,
        target_id: opts.target_id ?? null,
        metadata: opts.metadata ?? null,
        session_id: opts.session_id ?? getSessionId(),
      }),
    });
  } catch {
    // Silently swallow — tracking should never break the UI
  }
}

/**
 * Hook that tracks time spent on a page/section.
 * Fires `profile_view` on mount and logs duration on unmount.
 */
export function useProfileViewTracker(username: string | undefined) {
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!username) return;
    trackEvent("profile_view", { target_id: username });
    startRef.current = Date.now();

    return () => {
      const duration = Math.floor((Date.now() - startRef.current) / 1000);
      trackEvent("profile_view", {
        target_id: username,
        metadata: { duration_seconds: duration, type: "leave" },
      });
    };
  }, [username]);
}

/**
 * Hook that fires `session_start` once on mount and `session_end` on page unload.
 */
export function useSessionTracker() {
  useEffect(() => {
    trackEvent("session_start");

    const handleUnload = () => {
      // Use sendBeacon for reliability on page close
      const payload = JSON.stringify({
        event_type: "session_end",
        session_id: getSessionId(),
      });
      navigator.sendBeacon?.("/api/v1/feed/track", new Blob([payload], { type: "application/json" }));
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);
}
