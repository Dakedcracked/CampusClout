"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface GlobalChatMessage {
  id: string;
  sender_id: string;
  username: string;
  display_name: string | null;
  content: string;
  token_reward: number;
  is_rush_hour: boolean;
  image_url: string | null;
  image_type: string | null;
  created_at: string;
}

export function useGlobalChat() {
  const [messages, setMessages] = useState<GlobalChatMessage[]>([]);
  const [rushHour, setRushHour] = useState(false);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      // Use relative URL so it goes through Next.js proxy (cookies forwarded)
      const res = await fetch(`/api/v1/global-chat/history?limit=50`, {
        credentials: "include",
      });
      if (res.ok) {
        const data: GlobalChatMessage[] = await res.json();
        setMessages(data);
      }
    } catch {}
  }, []);

  const getTicket = useCallback(async (): Promise<string | null> => {
    try {
      // Use relative URL so cookies are forwarded through Next.js proxy
      const res = await fetch(`/api/v1/auth/ws-ticket`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      const d = await res.json();
      return d.ticket ?? null;
    } catch {
      return null;
    }
  }, []);

  const connect = useCallback(async () => {
    const ticket = await getTicket();

    // WebSocket must go directly to the backend since Next.js doesn't proxy WS
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const wsBase = backendUrl.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/api/v1/global-chat/ws?ticket=${ticket || 'anon'}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.event === "connected") {
          setRushHour(data.rush_hour ?? false);
        } else if (data.event === "global_message") {
          setMessages((prev) => {
            // Prevent duplicate messages based on ID
            const messageIds = new Set(prev.map((m) => m.id));
            if (!messageIds.has(data.id)) {
              return [...prev, data as GlobalChatMessage];
            }
            return prev;
          });
        } else if (data.event === "rush_hour_change") {
          setRushHour(data.active ?? false);
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
      // Auto-reconnect after 3 seconds
      reconnectRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
  }, [getTicket]);

  useEffect(() => {
    loadHistory();
    connect();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [loadHistory, connect]);

  const sendMessage = useCallback(async (content: string, imageUrl?: string | null, imageType?: string | null) => {
    // Use relative URL so cookies are forwarded through Next.js proxy
    const res = await fetch(`/api/v1/global-chat/send`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        content, 
        ...(imageUrl && { image_url: imageUrl }),
        ...(imageType && { image_type: imageType })
      }),
    });
    return res.ok;
  }, []);

  return { messages, rushHour, connected, sendMessage };
}
