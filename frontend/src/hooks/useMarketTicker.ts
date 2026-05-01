"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TickerEvent {
  event: string;
  user_id: string;
  username: string;
  display_name: string | null;
  market_cap: number;
  tokens_invested_in_me: number;
  delta: number;
  delta_pct: number;
  ts: number; // client-side timestamp for keying
}

const WS_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8000/api/v1/ws/ticker`
    : "";

const MAX_EVENTS = 30;
const RECONNECT_DELAY_MS = 3000;

export function useMarketTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!WS_URL || !mountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) setConnected(true);
      if (pingRef.current) clearInterval(pingRef.current);
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        else { clearInterval(pingRef.current!); pingRef.current = null; }
      }, 30_000);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as Omit<TickerEvent, "ts">;
        if (data.event !== "market_cap_update") return;
        const event: TickerEvent = { ...data, ts: Date.now() };
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      } catch {
        // malformed JSON — ignore
      }
    };

    ws.onclose = () => {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
      if (!mountedRef.current) return;
      setConnected(false);
      timerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, [connect]);

  return { events, connected };
}
