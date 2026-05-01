"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE = API.replace(/^http/, "ws");

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

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/global-chat/history?limit=50`, {
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
      const res = await fetch(`${API}/api/v1/auth/ws-ticket`, {
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
    if (!ticket) return;

    const ws = new WebSocket(`${WS_BASE}/api/v1/global-chat/ws?ticket=${ticket}`);
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
    };
  }, [getTicket]);

  useEffect(() => {
    loadHistory();
    connect();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [loadHistory, connect]);

  const sendMessage = useCallback(async (content: string, imageUrl?: string, imageType?: string) => {
    const res = await fetch(`${API}/api/v1/global-chat/send`, {
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
